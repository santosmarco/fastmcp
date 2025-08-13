/**
 * FastMCP Utilities
 * 
 * This module exports all utility functions and classes for FastMCP,
 * providing logging, caching, configuration, and performance utilities.
 */

// Logging utilities
export * from "./logging.js"

// Caching utilities  
export * from "./cache.js"

// Configuration utilities
export * from "./config.js"

/**
 * Performance monitoring utilities
 */
import { Effect, Duration, Ref } from "effect"
import { getLogger } from "./logging.js"

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  readonly operationName: string
  readonly startTime: number
  readonly endTime?: number
  readonly duration?: number
  readonly memoryUsage?: {
    readonly start: NodeJS.MemoryUsage
    readonly end?: NodeJS.MemoryUsage
    readonly delta?: {
      readonly rss: number
      readonly heapUsed: number
      readonly heapTotal: number
    }
  }
  readonly success: boolean
  readonly error?: Error
}

/**
 * Performance tracker
 */
export class PerformanceTracker {
  private readonly metrics: Ref.Ref<PerformanceMetrics[]>

  constructor() {
    this.metrics = Ref.unsafeMake<PerformanceMetrics[]>([])
  }

  /**
   * Track performance of an Effect
   */
  readonly track = <A, E, R>(
    operationName: string,
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R> =>
    Effect.gen(function* () {
      const startTime = Date.now()
      const startMemory = process.memoryUsage()
      
      try {
        const result = yield* effect
        const endTime = Date.now()
        const endMemory = process.memoryUsage()
        
        const metric: PerformanceMetrics = {
          operationName,
          startTime,
          endTime,
          duration: endTime - startTime,
          memoryUsage: {
            start: startMemory,
            end: endMemory,
            delta: {
              rss: endMemory.rss - startMemory.rss,
              heapUsed: endMemory.heapUsed - startMemory.heapUsed,
              heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            },
          },
          success: true,
        }
        
        yield* Ref.update(this.metrics, (metrics) => [...metrics, metric])
        return result
      } catch (error) {
        const endTime = Date.now()
        const endMemory = process.memoryUsage()
        
        const metric: PerformanceMetrics = {
          operationName,
          startTime,
          endTime,
          duration: endTime - startTime,
          memoryUsage: {
            start: startMemory,
            end: endMemory,
            delta: {
              rss: endMemory.rss - startMemory.rss,
              heapUsed: endMemory.heapUsed - startMemory.heapUsed,
              heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            },
          },
          success: false,
          error: error as Error,
        }
        
        yield* Ref.update(this.metrics, (metrics) => [...metrics, metric])
        throw error
      }
    }.bind(this))

  /**
   * Get all performance metrics
   */
  readonly getMetrics = (): Effect.Effect<readonly PerformanceMetrics[], never> =>
    Ref.get(this.metrics)

  /**
   * Get performance summary
   */
  readonly getSummary = (): Effect.Effect<{
    readonly totalOperations: number
    readonly successfulOperations: number
    readonly failedOperations: number
    readonly averageDuration: number
    readonly totalDuration: number
    readonly operationBreakdown: Record<string, {
      readonly count: number
      readonly averageDuration: number
      readonly successRate: number
    }>
  }, never> =>
    Effect.gen(function* () {
      const metrics = yield* Ref.get(this.metrics)
      
      const totalOperations = metrics.length
      const successfulOperations = metrics.filter(m => m.success).length
      const failedOperations = totalOperations - successfulOperations
      const totalDuration = metrics.reduce((sum, m) => sum + (m.duration ?? 0), 0)
      const averageDuration = totalOperations > 0 ? totalDuration / totalOperations : 0
      
      const operationBreakdown: Record<string, {
        count: number
        averageDuration: number
        successRate: number
      }> = {}
      
      for (const metric of metrics) {
        if (!operationBreakdown[metric.operationName]) {
          operationBreakdown[metric.operationName] = {
            count: 0,
            averageDuration: 0,
            successRate: 0,
          }
        }
        
        const breakdown = operationBreakdown[metric.operationName]!
        breakdown.count++
        breakdown.averageDuration = (breakdown.averageDuration * (breakdown.count - 1) + (metric.duration ?? 0)) / breakdown.count
      }
      
      // Calculate success rates
      for (const [operationName, breakdown] of Object.entries(operationBreakdown)) {
        const operationMetrics = metrics.filter(m => m.operationName === operationName)
        const successfulCount = operationMetrics.filter(m => m.success).length
        breakdown.successRate = successfulCount / operationMetrics.length
      }
      
      return {
        totalOperations,
        successfulOperations,
        failedOperations,
        averageDuration,
        totalDuration,
        operationBreakdown,
      }
    }.bind(this))

  /**
   * Clear all metrics
   */
  readonly clear = (): Effect.Effect<void, never> =>
    Ref.set(this.metrics, [])

  /**
   * Log performance summary
   */
  readonly logSummary = (): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const logger = getLogger("performance")
      const summary = yield* this.getSummary()
      
      yield* logger.info("Performance Summary", {
        totalOperations: summary.totalOperations,
        successfulOperations: summary.successfulOperations,
        failedOperations: summary.failedOperations,
        averageDuration: Math.round(summary.averageDuration),
        totalDuration: Math.round(summary.totalDuration),
      })
      
      for (const [operation, breakdown] of Object.entries(summary.operationBreakdown)) {
        yield* logger.info(`Operation: ${operation}`, {
          count: breakdown.count,
          averageDuration: Math.round(breakdown.averageDuration),
          successRate: Math.round(breakdown.successRate * 100),
        })
      }
    }.bind(this))
}

/**
 * Global performance tracker instance
 */
export const globalPerformanceTracker = new PerformanceTracker()

/**
 * Convenience function to track performance
 */
export const trackPerformance = <A, E, R>(
  operationName: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  globalPerformanceTracker.track(operationName, effect)

/**
 * Rate limiting utilities
 */

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  readonly maxRequests: number
  readonly windowMs: number
  readonly keyGenerator?: (context: unknown) => string
}

/**
 * Rate limiter implementation
 */
export class RateLimiter {
  private readonly requests: Map<string, number[]> = new Map()
  private readonly config: RateLimiterConfig

  constructor(config: RateLimiterConfig) {
    this.config = config
  }

  /**
   * Check if request is allowed
   */
  readonly isAllowed = (key: string = "default"): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      const now = Date.now()
      const windowStart = now - this.config.windowMs
      
      // Get existing requests for this key
      let requests = this.requests.get(key) ?? []
      
      // Filter out old requests
      requests = requests.filter(time => time > windowStart)
      
      // Check if we can add another request
      if (requests.length >= this.config.maxRequests) {
        return false
      }
      
      // Add current request
      requests.push(now)
      this.requests.set(key, requests)
      
      return true
    }.bind(this))

  /**
   * Get remaining requests for key
   */
  readonly getRemaining = (key: string = "default"): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const now = Date.now()
      const windowStart = now - this.config.windowMs
      
      const requests = this.requests.get(key) ?? []
      const validRequests = requests.filter(time => time > windowStart)
      
      return Math.max(0, this.config.maxRequests - validRequests.length)
    }.bind(this))

  /**
   * Clear all rate limit data
   */
  readonly clear = (): Effect.Effect<void, never> =>
    Effect.sync(() => {
      this.requests.clear()
    })
}

/**
 * Create a rate limiter
 */
export const createRateLimiter = (config: RateLimiterConfig): RateLimiter =>
  new RateLimiter(config)

/**
 * Rate limiting middleware for Effects
 */
export const rateLimitMiddleware = <A, E, R>(
  rateLimiter: RateLimiter,
  key: string = "default"
) =>
  (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | Error, R> =>
    Effect.gen(function* () {
      const allowed = yield* rateLimiter.isAllowed(key)
      
      if (!allowed) {
        yield* Effect.fail(new Error("Rate limit exceeded"))
      }
      
      return yield* effect
    })

/**
 * Utility functions
 */

/**
 * Retry with exponential backoff
 */
export const retryWithBackoff = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000,
  backoffMultiplier: number = 2
): Effect.Effect<A, E, R> =>
  Effect.retry(effect, {
    times: maxAttempts - 1,
    schedule: Effect.scheduleExponential(Duration.millis(baseDelayMs), backoffMultiplier).pipe(
      Effect.scheduleUpTo(Duration.millis(maxDelayMs))
    ),
  })

/**
 * Timeout with custom error
 */
export const timeoutWithError = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  timeoutMs: number,
  errorMessage: string = "Operation timed out"
): Effect.Effect<A, E | Error, R> =>
  Effect.race(
    effect,
    Effect.sleep(Duration.millis(timeoutMs)).pipe(
      Effect.flatMap(() => Effect.fail(new Error(errorMessage)))
    )
  )

/**
 * Circuit breaker pattern
 */
export interface CircuitBreakerConfig {
  readonly failureThreshold: number
  readonly resetTimeoutMs: number
  readonly monitoringPeriodMs: number
}

export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: "closed" | "open" | "half-open" = "closed"
  private readonly config: CircuitBreakerConfig

  constructor(config: CircuitBreakerConfig) {
    this.config = config
  }

  readonly execute = <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E | Error, R> =>
    Effect.gen(function* () {
      const now = Date.now()
      
      // Check if we should reset from open to half-open
      if (this.state === "open" && now - this.lastFailureTime > this.config.resetTimeoutMs) {
        this.state = "half-open"
      }
      
      // Reject immediately if circuit is open
      if (this.state === "open") {
        yield* Effect.fail(new Error("Circuit breaker is open"))
      }
      
      try {
        const result = yield* effect
        
        // Success - reset failure count and close circuit
        this.failures = 0
        this.state = "closed"
        
        return result
      } catch (error) {
        // Failure - increment counter and potentially open circuit
        this.failures++
        this.lastFailureTime = now
        
        if (this.failures >= this.config.failureThreshold) {
          this.state = "open"
        }
        
        throw error
      }
    }.bind(this))

  readonly getState = (): "closed" | "open" | "half-open" => this.state
  readonly getFailures = (): number => this.failures
}

/**
 * Create a circuit breaker
 */
export const createCircuitBreaker = (config: CircuitBreakerConfig): CircuitBreaker =>
  new CircuitBreaker(config)

/**
 * Export utility collections
 */
export const performance = {
  PerformanceTracker,
  globalPerformanceTracker,
  trackPerformance,
}

export const rateLimit = {
  RateLimiter,
  createRateLimiter,
  rateLimitMiddleware,
}

export const resilience = {
  retryWithBackoff,
  timeoutWithError,
  CircuitBreaker,
  createCircuitBreaker,
}