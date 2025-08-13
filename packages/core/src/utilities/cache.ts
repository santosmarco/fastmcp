/**
 * FastMCP Caching System using Effect
 * 
 * This module provides a comprehensive caching system built with Effect,
 * offering TTL (Time-To-Live) and LRU (Least Recently Used) caching strategies
 * with type safety and composability.
 */

import { Effect, Ref, Schedule, Duration, Clock, HashMap, Context, Layer, pipe } from "effect"
import { getLogger } from "./logging.js"

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T> {
  readonly value: T
  readonly createdAt: number
  readonly accessedAt: number
  readonly accessCount: number
  readonly ttl?: number
}

/**
 * Cache statistics
 */
export interface CacheStats {
  readonly hits: number
  readonly misses: number
  readonly sets: number
  readonly deletes: number
  readonly evictions: number
  readonly size: number
  readonly hitRate: number
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  readonly maxSize?: number
  readonly defaultTTL?: number
  readonly cleanupInterval?: number
  readonly enableStats?: boolean
}

/**
 * Cache interface
 */
export interface Cache<K, V> {
  readonly get: (key: K) => Effect.Effect<V | undefined, never>
  readonly set: (key: K, value: V, ttl?: number) => Effect.Effect<void, never>
  readonly delete: (key: K) => Effect.Effect<boolean, never>
  readonly has: (key: K) => Effect.Effect<boolean, never>
  readonly clear: () => Effect.Effect<void, never>
  readonly size: () => Effect.Effect<number, never>
  readonly keys: () => Effect.Effect<readonly K[], never>
  readonly values: () => Effect.Effect<readonly V[], never>
  readonly entries: () => Effect.Effect<readonly [K, V][], never>
  readonly getStats: () => Effect.Effect<CacheStats, never>
  readonly cleanup: () => Effect.Effect<number, never>
}

/**
 * In-memory cache implementation with TTL and LRU support
 */
export class InMemoryCache<K, V> implements Cache<K, V> {
  private readonly storage: Ref.Ref<HashMap.HashMap<K, CacheEntry<V>>>
  private readonly stats: Ref.Ref<Omit<CacheStats, "size" | "hitRate">>
  private readonly config: Required<CacheConfig>
  private cleanupFiber?: Effect.Fiber<never, number>

  constructor(config: CacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize ?? 1000,
      defaultTTL: config.defaultTTL ?? 300000, // 5 minutes
      cleanupInterval: config.cleanupInterval ?? 60000, // 1 minute
      enableStats: config.enableStats ?? true,
    }

    this.storage = Ref.unsafeMake(HashMap.empty<K, CacheEntry<V>>())
    this.stats = Ref.unsafeMake({
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
    })

    // Start cleanup process
    this.startCleanup()
  }

  readonly get = (key: K): Effect.Effect<V | undefined, never> =>
    Effect.gen(function* () {
      const storage = yield* Ref.get(this.storage)
      const entry = HashMap.get(storage, key)

      if (!entry) {
        yield* this.incrementStat("misses")
        return undefined
      }

      const now = Date.now()

      // Check TTL expiration
      if (entry.ttl && now > entry.createdAt + entry.ttl) {
        yield* Ref.update(this.storage, HashMap.remove(key))
        yield* this.incrementStat("misses")
        return undefined
      }

      // Update access time and count
      const updatedEntry: CacheEntry<V> = {
        ...entry,
        accessedAt: now,
        accessCount: entry.accessCount + 1,
      }

      yield* Ref.update(this.storage, HashMap.set(key, updatedEntry))
      yield* this.incrementStat("hits")

      return entry.value
    }.bind(this))

  readonly set = (key: K, value: V, ttl?: number): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const now = Date.now()
      const entry: CacheEntry<V> = {
        value,
        createdAt: now,
        accessedAt: now,
        accessCount: 1,
        ttl: ttl ?? this.config.defaultTTL,
      }

      let storage = yield* Ref.get(this.storage)

      // Check if we need to evict entries due to size limit
      if (HashMap.size(storage) >= this.config.maxSize && !HashMap.has(storage, key)) {
        yield* this.evictLRU()
        storage = yield* Ref.get(this.storage)
      }

      yield* Ref.update(this.storage, HashMap.set(key, entry))
      yield* this.incrementStat("sets")
    }.bind(this))

  readonly delete = (key: K): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      const storage = yield* Ref.get(this.storage)
      const existed = HashMap.has(storage, key)

      if (existed) {
        yield* Ref.update(this.storage, HashMap.remove(key))
        yield* this.incrementStat("deletes")
      }

      return existed
    }.bind(this))

  readonly has = (key: K): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      const storage = yield* Ref.get(this.storage)
      const entry = HashMap.get(storage, key)

      if (!entry) {
        return false
      }

      // Check TTL expiration
      if (entry.ttl && Date.now() > entry.createdAt + entry.ttl) {
        yield* Ref.update(this.storage, HashMap.remove(key))
        return false
      }

      return true
    }.bind(this))

  readonly clear = (): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      yield* Ref.set(this.storage, HashMap.empty())
      yield* Ref.update(this.stats, (stats) => ({
        ...stats,
        deletes: stats.deletes + 1,
      }))
    }.bind(this))

  readonly size = (): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const storage = yield* Ref.get(this.storage)
      return HashMap.size(storage)
    }.bind(this))

  readonly keys = (): Effect.Effect<readonly K[], never> =>
    Effect.gen(function* () {
      const storage = yield* Ref.get(this.storage)
      return Array.from(HashMap.keys(storage))
    }.bind(this))

  readonly values = (): Effect.Effect<readonly V[], never> =>
    Effect.gen(function* () {
      const storage = yield* Ref.get(this.storage)
      return Array.from(HashMap.values(storage)).map(entry => entry.value)
    }.bind(this))

  readonly entries = (): Effect.Effect<readonly [K, V][], never> =>
    Effect.gen(function* () {
      const storage = yield* Ref.get(this.storage)
      return Array.from(HashMap.entries(storage)).map(([key, entry]) => [key, entry.value] as [K, V])
    }.bind(this))

  readonly getStats = (): Effect.Effect<CacheStats, never> =>
    Effect.gen(function* () {
      const stats = yield* Ref.get(this.stats)
      const currentSize = yield* this.size()
      const totalRequests = stats.hits + stats.misses
      const hitRate = totalRequests > 0 ? stats.hits / totalRequests : 0

      return {
        ...stats,
        size: currentSize,
        hitRate,
      }
    }.bind(this))

  readonly cleanup = (): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const storage = yield* Ref.get(this.storage)
      const now = Date.now()
      let evicted = 0

      const cleanStorage = HashMap.filter(storage, (entry) => {
        if (entry.ttl && now > entry.createdAt + entry.ttl) {
          evicted++
          return false
        }
        return true
      })

      yield* Ref.set(this.storage, cleanStorage)
      
      if (evicted > 0) {
        yield* this.incrementStat("evictions", evicted)
      }

      return evicted
    }.bind(this))

  /**
   * Start automatic cleanup process
   */
  private startCleanup(): void {
    const cleanupEffect = Effect.gen(function* () {
      while (true) {
        yield* Effect.sleep(Duration.millis(this.config.cleanupInterval))
        const evicted = yield* this.cleanup()
        
        if (evicted > 0) {
          const logger = getLogger("cache")
          yield* logger.debug(`Cache cleanup evicted ${evicted} expired entries`)
        }
      }
    }.bind(this))

    this.cleanupFiber = Effect.runFork(cleanupEffect)
  }

  /**
   * Evict least recently used entry
   */
  private readonly evictLRU = (): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const storage = yield* Ref.get(this.storage)
      
      if (HashMap.size(storage) === 0) {
        return
      }

      // Find LRU entry
      let lruKey: K | undefined
      let lruAccessedAt = Infinity

      for (const [key, entry] of HashMap.entries(storage)) {
        if (entry.accessedAt < lruAccessedAt) {
          lruAccessedAt = entry.accessedAt
          lruKey = key
        }
      }

      if (lruKey !== undefined) {
        yield* Ref.update(this.storage, HashMap.remove(lruKey))
        yield* this.incrementStat("evictions")
      }
    }.bind(this))

  /**
   * Increment a statistic counter
   */
  private readonly incrementStat = (
    stat: keyof Omit<CacheStats, "size" | "hitRate">, 
    amount: number = 1
  ): Effect.Effect<void, never> =>
    this.config.enableStats
      ? Ref.update(this.stats, (stats) => ({
          ...stats,
          [stat]: stats[stat] + amount,
        }))
      : Effect.void

  /**
   * Shutdown the cache and cleanup resources
   */
  readonly shutdown = (): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      if (this.cleanupFiber) {
        yield* Effect.interrupt(this.cleanupFiber)
      }
      yield* this.clear()
    }.bind(this))
}

/**
 * Cache factory functions
 */

/**
 * Create an in-memory cache
 */
export const createCache = <K, V>(config?: CacheConfig): Cache<K, V> =>
  new InMemoryCache<K, V>(config)

/**
 * Create a cache with specific TTL
 */
export const createTTLCache = <K, V>(ttlMs: number, config?: Omit<CacheConfig, 'defaultTTL'>): Cache<K, V> =>
  createCache({ ...config, defaultTTL: ttlMs })

/**
 * Create a cache with specific size limit
 */
export const createLRUCache = <K, V>(maxSize: number, config?: Omit<CacheConfig, 'maxSize'>): Cache<K, V> =>
  createCache({ ...config, maxSize })

/**
 * Cache Context for dependency injection
 */
export const CacheContext = <K, V>() => Context.GenericTag<Cache<K, V>>("@fastmcp/core/Cache")

/**
 * Create a cache layer
 */
export const createCacheLayer = <K, V>(config?: CacheConfig): Layer.Layer<Cache<K, V>, never> =>
  Layer.succeed(CacheContext<K, V>(), createCache<K, V>(config))

/**
 * Memoization utilities
 */

/**
 * Memoize an Effect with caching
 */
export const memoize = <A extends readonly unknown[], R, E, B>(
  fn: (...args: A) => Effect.Effect<B, E, R>,
  keyFn: (...args: A) => string = (...args) => JSON.stringify(args),
  ttl?: number
) => {
  const cache = createCache<string, B>({ defaultTTL: ttl })

  return (...args: A): Effect.Effect<B, E, R> =>
    Effect.gen(function* () {
      const key = keyFn(...args)
      const cached = yield* cache.get(key)

      if (cached !== undefined) {
        return cached
      }

      const result = yield* fn(...args)
      yield* cache.set(key, result, ttl)
      return result
    })
}

/**
 * Memoize with custom cache
 */
export const memoizeWithCache = <A extends readonly unknown[], R, E, B, K>(
  fn: (...args: A) => Effect.Effect<B, E, R>,
  cache: Cache<K, B>,
  keyFn: (...args: A) => K
) =>
  (...args: A): Effect.Effect<B, E, R> =>
    Effect.gen(function* () {
      const key = keyFn(...args)
      const cached = yield* cache.get(key)

      if (cached !== undefined) {
        return cached
      }

      const result = yield* fn(...args)
      yield* cache.set(key, result)
      return result
    })

/**
 * Cache-aside pattern implementation
 */
export const cacheAside = <K, V, E, R>(
  cache: Cache<K, V>,
  loader: (key: K) => Effect.Effect<V, E, R>,
  ttl?: number
) =>
  (key: K): Effect.Effect<V, E, R> =>
    Effect.gen(function* () {
      // Try cache first
      const cached = yield* cache.get(key)
      if (cached !== undefined) {
        return cached
      }

      // Load from source
      const value = yield* loader(key)
      
      // Store in cache
      yield* cache.set(key, value, ttl)
      
      return value
    })

/**
 * Write-through cache pattern
 */
export const writeThrough = <K, V, E, R>(
  cache: Cache<K, V>,
  writer: (key: K, value: V) => Effect.Effect<void, E, R>,
  ttl?: number
) =>
  (key: K, value: V): Effect.Effect<void, E, R> =>
    Effect.gen(function* () {
      // Write to both cache and storage
      yield* cache.set(key, value, ttl)
      yield* writer(key, value)
    })

/**
 * Write-behind cache pattern
 */
export const writeBehind = <K, V, E, R>(
  cache: Cache<K, V>,
  writer: (key: K, value: V) => Effect.Effect<void, E, R>,
  flushInterval: number = 5000,
  ttl?: number
) => {
  const pendingWrites = createCache<K, V>()

  // Start background flush process
  const flushProcess = Effect.gen(function* () {
    while (true) {
      yield* Effect.sleep(Duration.millis(flushInterval))
      
      const entries = yield* pendingWrites.entries()
      
      if (entries.length > 0) {
        // Flush pending writes
        yield* Effect.forEach(entries, ([key, value]) =>
          Effect.gen(function* () {
            yield* writer(key, value)
            yield* pendingWrites.delete(key)
          })
        )
        
        const logger = getLogger("cache")
        yield* logger.debug(`Flushed ${entries.length} pending cache writes`)
      }
    }
  })

  Effect.runFork(flushProcess)

  return (key: K, value: V): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      // Write to cache immediately
      yield* cache.set(key, value, ttl)
      
      // Queue for background write
      yield* pendingWrites.set(key, value)
    })
}

/**
 * Distributed cache interface (for future implementation)
 */
export interface DistributedCache<K, V> extends Cache<K, V> {
  readonly invalidate: (key: K) => Effect.Effect<void, never>
  readonly invalidatePattern: (pattern: string) => Effect.Effect<number, never>
  readonly getNode: (key: K) => Effect.Effect<string, never>
}

/**
 * Cache utilities
 */
export const cacheUtils = {
  /**
   * Warm up cache with predefined values
   */
  warmUp: <K, V>(cache: Cache<K, V>, entries: readonly [K, V][], ttl?: number): Effect.Effect<void, never> =>
    Effect.forEach(entries, ([key, value]) => cache.set(key, value, ttl)).pipe(Effect.asVoid),

  /**
   * Get cache efficiency metrics
   */
  getEfficiency: (cache: Cache<any, any>): Effect.Effect<{ hitRate: number; efficiency: string }, never> =>
    Effect.gen(function* () {
      const stats = yield* cache.getStats()
      const efficiency = stats.hitRate >= 0.8 ? "Excellent" :
                        stats.hitRate >= 0.6 ? "Good" :
                        stats.hitRate >= 0.4 ? "Fair" : "Poor"
      
      return { hitRate: stats.hitRate, efficiency }
    }),

  /**
   * Monitor cache performance
   */
  monitor: (cache: Cache<any, any>, intervalMs: number = 30000): Effect.Effect<never, never> =>
    Effect.gen(function* () {
      const logger = getLogger("cache-monitor")
      
      while (true) {
        yield* Effect.sleep(Duration.millis(intervalMs))
        
        const stats = yield* cache.getStats()
        yield* logger.info("Cache performance", {
          size: stats.size,
          hitRate: Math.round(stats.hitRate * 100),
          hits: stats.hits,
          misses: stats.misses,
          evictions: stats.evictions,
        })
      }
    }),
}

/**
 * Export commonly used caching patterns
 */
export const caching = {
  createCache,
  createTTLCache,
  createLRUCache,
  createCacheLayer,
  memoize,
  memoizeWithCache,
  cacheAside,
  writeThrough,
  writeBehind,
  ...cacheUtils,
}