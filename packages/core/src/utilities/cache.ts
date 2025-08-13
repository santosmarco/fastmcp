/**
 * FastMCP Caching System
 * 
 * Simple timed cache matching the original Python implementation.
 * Provides TTL-based expiration with basic get/set/clear operations.
 */

/**
 * Simple timed cache with TTL expiration.
 * Matches the original Python TimedCache implementation.
 */
export class TimedCache<K = any, V = any> {
  static readonly NOT_FOUND = Symbol('NOT_FOUND')
  
  private readonly cache = new Map<K, [V, Date]>()
  private readonly expiration: number // milliseconds

  constructor(expiration: number) {
    this.expiration = expiration
  }

  /**
   * Set a value in the cache with TTL expiration
   */
  set(key: K, value: V): void {
    const expires = new Date(Date.now() + this.expiration)
    this.cache.set(key, [value, expires])
  }

  /**
   * Get a value from the cache, returns NOT_FOUND if expired or missing
   */
  get(key: K): V | typeof TimedCache.NOT_FOUND {
    const entry = this.cache.get(key)
    if (entry && entry[1] > new Date()) {
      return entry[0]
    } else {
      // Clean up expired entry
      if (entry) {
        this.cache.delete(key)
      }
      return TimedCache.NOT_FOUND
    }
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get the current size of the cache
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: K): boolean {
    return this.get(key) !== TimedCache.NOT_FOUND
  }
}