/**
 * FastMCP Logging System using Effect Logger
 * 
 * This module provides a comprehensive logging system built on Effect's Logger,
 * replacing Python's logging with structured, contextual, and type-safe logging.
 */

import { Effect, Logger, LogLevel, FiberRef, Context, Layer, pipe } from "effect"
import { formatISO } from "date-fns"

/**
 * Log levels matching Python's logging levels
 */
export const FastMCPLogLevel = {
  DEBUG: LogLevel.Debug,
  INFO: LogLevel.Info, 
  WARNING: LogLevel.Warning,
  ERROR: LogLevel.Error,
  CRITICAL: LogLevel.Fatal,
} as const

export type FastMCPLogLevelType = typeof FastMCPLogLevel[keyof typeof FastMCPLogLevel]

/**
 * Structured log entry
 */
export interface LogEntry {
  readonly timestamp: string
  readonly level: LogLevel.LogLevel
  readonly message: string
  readonly context?: Record<string, unknown>
  readonly component?: string
  readonly requestId?: string
  readonly userId?: string
  readonly error?: Error
  readonly duration?: number
  readonly metadata?: Record<string, unknown>
}

/**
 * Logging context for request tracking
 */
export interface LoggingContext {
  readonly component: string
  readonly requestId?: string
  readonly userId?: string
  readonly sessionId?: string
  readonly metadata?: Record<string, unknown>
}

/**
 * Logging context service
 */
export const LoggingContext = Context.GenericTag<LoggingContext>("@fastmcp/core/LoggingContext")

/**
 * Default logging context
 */
const defaultLoggingContext: LoggingContext = {
  component: "fastmcp",
}

/**
 * Fiber-local logging context
 */
const loggingContextRef = FiberRef.unsafeMake(defaultLoggingContext)

/**
 * Enhanced logger interface
 */
export interface FastMCPLogger {
  readonly debug: (message: string, context?: Record<string, unknown>) => Effect.Effect<void>
  readonly info: (message: string, context?: Record<string, unknown>) => Effect.Effect<void>
  readonly warning: (message: string, context?: Record<string, unknown>) => Effect.Effect<void>
  readonly error: (message: string, error?: Error, context?: Record<string, unknown>) => Effect.Effect<void>
  readonly critical: (message: string, error?: Error, context?: Record<string, unknown>) => Effect.Effect<void>
  readonly withContext: (context: Partial<LoggingContext>) => FastMCPLogger
  readonly withComponent: (component: string) => FastMCPLogger
  readonly withRequestId: (requestId: string) => FastMCPLogger
  readonly withUserId: (userId: string) => FastMCPLogger
  readonly time: <A, E, R>(
    operation: string,
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>
}

/**
 * Create a structured log entry
 */
const createLogEntry = (
  level: LogLevel.LogLevel,
  message: string,
  context: LoggingContext,
  additionalContext?: Record<string, unknown>,
  error?: Error,
  duration?: number
): LogEntry => ({
  timestamp: formatISO(new Date()),
  level,
  message,
  component: context.component,
  requestId: context.requestId,
  userId: context.userId,
  context: {
    ...context.metadata,
    ...additionalContext,
    ...(context.sessionId && { sessionId: context.sessionId }),
  },
  ...(error && { error }),
  ...(duration !== undefined && { duration }),
})

/**
 * Format log entry for output
 */
const formatLogEntry = (entry: LogEntry): string => {
  const level = LogLevel.literal(entry.level).toUpperCase()
  const component = entry.component ? `[${entry.component}]` : ""
  const requestId = entry.requestId ? `[req:${entry.requestId}]` : ""
  const userId = entry.userId ? `[user:${entry.userId}]` : ""
  const duration = entry.duration !== undefined ? ` (${entry.duration}ms)` : ""
  
  let formatted = `${entry.timestamp} ${level} ${component}${requestId}${userId} ${entry.message}${duration}`
  
  if (entry.context && Object.keys(entry.context).length > 0) {
    formatted += ` | Context: ${JSON.stringify(entry.context)}`
  }
  
  if (entry.error) {
    formatted += `\n  Error: ${entry.error.message}`
    if (entry.error.stack) {
      formatted += `\n  Stack: ${entry.error.stack}`
    }
  }
  
  return formatted
}

/**
 * Custom logger implementation
 */
class FastMCPLoggerImpl implements FastMCPLogger {
  constructor(private readonly baseContext: LoggingContext = defaultLoggingContext) {}

  readonly debug = (message: string, context?: Record<string, unknown>): Effect.Effect<void> =>
    this.log(LogLevel.Debug, message, context)

  readonly info = (message: string, context?: Record<string, unknown>): Effect.Effect<void> =>
    this.log(LogLevel.Info, message, context)

  readonly warning = (message: string, context?: Record<string, unknown>): Effect.Effect<void> =>
    this.log(LogLevel.Warning, message, context)

  readonly error = (message: string, error?: Error, context?: Record<string, unknown>): Effect.Effect<void> =>
    this.log(LogLevel.Error, message, context, error)

  readonly critical = (message: string, error?: Error, context?: Record<string, unknown>): Effect.Effect<void> =>
    this.log(LogLevel.Fatal, message, context, error)

  readonly withContext = (context: Partial<LoggingContext>): FastMCPLogger =>
    new FastMCPLoggerImpl({ ...this.baseContext, ...context })

  readonly withComponent = (component: string): FastMCPLogger =>
    this.withContext({ component })

  readonly withRequestId = (requestId: string): FastMCPLogger =>
    this.withContext({ requestId })

  readonly withUserId = (userId: string): FastMCPLogger =>
    this.withContext({ userId })

  readonly time = <A, E, R>(
    operation: string,
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R> =>
    Effect.gen(function* () {
      const start = yield* Effect.sync(() => Date.now())
      yield* this.debug(`Starting ${operation}`)
      
      try {
        const result = yield* effect
        const duration = yield* Effect.sync(() => Date.now() - start)
        yield* this.info(`Completed ${operation}`, { duration })
        return result
      } catch (error) {
        const duration = yield* Effect.sync(() => Date.now() - start)
        yield* this.error(`Failed ${operation}`, error as Error, { duration })
        throw error
      }
    }.bind(this))

  private readonly log = (
    level: LogLevel.LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
    duration?: number
  ): Effect.Effect<void> =>
    Effect.gen(function* () {
      // Get current fiber context
      const currentContext = yield* FiberRef.get(loggingContextRef)
      const mergedContext = { ...this.baseContext, ...currentContext }
      
      // Create log entry
      const entry = createLogEntry(level, message, mergedContext, context, error, duration)
      
      // Format and output
      const formatted = formatLogEntry(entry)
      yield* Logger.log(level, formatted)
    })
}

/**
 * Create a FastMCP logger
 */
export const createLogger = (context?: Partial<LoggingContext>): FastMCPLogger =>
  new FastMCPLoggerImpl(context ? { ...defaultLoggingContext, ...context } : defaultLoggingContext)

/**
 * Get the default logger
 */
export const getLogger = (component?: string): FastMCPLogger =>
  createLogger(component ? { component } : undefined)

/**
 * Logging utilities
 */

/**
 * Set logging context for the current fiber
 */
export const setLoggingContext = (context: Partial<LoggingContext>): Effect.Effect<void> =>
  FiberRef.update(loggingContextRef, (current) => ({ ...current, ...context }))

/**
 * Get current logging context
 */
export const getLoggingContext = (): Effect.Effect<LoggingContext> =>
  FiberRef.get(loggingContextRef)

/**
 * Run an effect with specific logging context
 */
export const withLoggingContext = <A, E, R>(
  context: Partial<LoggingContext>,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const current = yield* FiberRef.get(loggingContextRef)
    const merged = { ...current, ...context }
    return yield* Effect.locally(loggingContextRef, merged)(effect)
  })

/**
 * Log execution time of an effect
 */
export const logExecutionTime = <A, E, R>(
  operation: string,
  effect: Effect.Effect<A, E, R>,
  logger?: FastMCPLogger
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const log = logger ?? getLogger()
    return yield* log.time(operation, effect)
  })

/**
 * Log and measure effect performance
 */
export const logPerformance = <A, E, R>(
  operation: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const logger = getLogger("performance")
    const start = yield* Effect.sync(() => {
      const now = Date.now()
      const memory = process.memoryUsage()
      return { time: now, memory }
    })
    
    yield* logger.debug(`Starting ${operation}`, {
      memoryUsage: start.memory,
    })
    
    try {
      const result = yield* effect
      const end = yield* Effect.sync(() => {
        const now = Date.now()
        const memory = process.memoryUsage()
        return { time: now, memory }
      })
      
      const duration = end.time - start.time
      const memoryDelta = {
        rss: end.memory.rss - start.memory.rss,
        heapUsed: end.memory.heapUsed - start.memory.heapUsed,
        heapTotal: end.memory.heapTotal - start.memory.heapTotal,
      }
      
      yield* logger.info(`Completed ${operation}`, {
        duration,
        memoryDelta,
        finalMemoryUsage: end.memory,
      })
      
      return result
    } catch (error) {
      const end = yield* Effect.sync(() => Date.now())
      const duration = end - start.time
      
      yield* logger.error(`Failed ${operation}`, error as Error, { duration })
      throw error
    }
  })

/**
 * Create a request-scoped logger
 */
export const createRequestLogger = (requestId: string, userId?: string): FastMCPLogger =>
  createLogger({
    component: "request",
    requestId,
    ...(userId && { userId }),
  })

/**
 * Logger middleware for Effects
 */
export const loggerMiddleware = <A, E, R>(
  operation: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const logger = getLogger("middleware")
    yield* logger.debug(`Entering ${operation}`)
    
    try {
      const result = yield* effect
      yield* logger.debug(`Exiting ${operation}`)
      return result
    } catch (error) {
      yield* logger.error(`Error in ${operation}`, error as Error)
      throw error
    }
  })

/**
 * Log level configuration
 */
export interface LoggingConfig {
  readonly level: FastMCPLogLevelType
  readonly enableColors?: boolean
  readonly enableTimestamps?: boolean
  readonly enableContext?: boolean
  readonly outputFormat?: "text" | "json"
  readonly component?: string
}

/**
 * Configure logging system
 */
export const configureLogging = (config: LoggingConfig): Layer.Layer<never> =>
  Logger.replace(
    Logger.defaultLogger,
    Logger.make(({ logLevel, message }) => {
      if (LogLevel.greaterThanOrEqualTo(logLevel, config.level)) {
        console.log(message)
      }
    })
  )

/**
 * JSON logger for structured output
 */
export const createJSONLogger = (): Layer.Layer<never> =>
  Logger.replace(
    Logger.defaultLogger,
    Logger.make(({ logLevel, message, cause, spans }) => {
      const entry = {
        timestamp: formatISO(new Date()),
        level: LogLevel.literal(logLevel),
        message,
        ...(cause && { cause: String(cause) }),
        ...(spans.length > 0 && { spans: spans.map(span => span.label) }),
      }
      console.log(JSON.stringify(entry))
    })
  )

/**
 * Development logger with colors and formatting
 */
export const createDevelopmentLogger = (): Layer.Layer<never> =>
  Logger.replace(
    Logger.defaultLogger,
    Logger.make(({ logLevel, message }) => {
      const colors = {
        [LogLevel.Debug]: '\x1b[36m',    // Cyan
        [LogLevel.Info]: '\x1b[32m',     // Green  
        [LogLevel.Warning]: '\x1b[33m',  // Yellow
        [LogLevel.Error]: '\x1b[31m',    // Red
        [LogLevel.Fatal]: '\x1b[35m',    // Magenta
      }
      
      const reset = '\x1b[0m'
      const color = colors[logLevel] || ''
      const levelText = LogLevel.literal(logLevel).toUpperCase().padEnd(8)
      
      console.log(`${color}${levelText}${reset} ${message}`)
    })
  )

/**
 * Silent logger for testing
 */
export const createSilentLogger = (): Layer.Layer<never> =>
  Logger.replace(
    Logger.defaultLogger,
    Logger.make(() => {
      // Silent - no output
    })
  )

/**
 * Batch logger that accumulates logs and flushes periodically
 */
export const createBatchLogger = (flushIntervalMs: number = 5000): Layer.Layer<never> => {
  const logs: string[] = []
  
  const flush = () => {
    if (logs.length > 0) {
      logs.forEach(log => console.log(log))
      logs.length = 0
    }
  }
  
  // Set up periodic flushing
  const interval = setInterval(flush, flushIntervalMs)
  
  // Flush on process exit
  process.on('exit', flush)
  process.on('SIGTERM', () => {
    clearInterval(interval)
    flush()
  })
  
  return Logger.replace(
    Logger.defaultLogger,
    Logger.make(({ message }) => {
      logs.push(message)
      
      // Flush immediately on errors
      if (message.includes('ERROR') || message.includes('FATAL')) {
        flush()
      }
    })
  )
}

/**
 * Export commonly used logging patterns
 */
export const logging = {
  createLogger,
  getLogger,
  withLoggingContext,
  logExecutionTime,
  logPerformance,
  createRequestLogger,
  loggerMiddleware,
  configureLogging,
  createJSONLogger,
  createDevelopmentLogger,
  createSilentLogger,
  createBatchLogger,
}