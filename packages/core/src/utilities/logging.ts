/**
 * FastMCP Logging System
 * 
 * Simple logging utilities matching the original Python implementation.
 * Provides logger namespace prefixing and basic configuration.
 */

import { Effect, Logger, LogLevel, Layer } from "effect"

/**
 * Log levels matching Python's logging levels
 */
export const LOG_LEVELS = {
  DEBUG: LogLevel.Debug,
  INFO: LogLevel.Info,
  WARNING: LogLevel.Warning,
  ERROR: LogLevel.Error,
  CRITICAL: LogLevel.Fatal,
} as const

export type LogLevelType = keyof typeof LOG_LEVELS

/**
 * Simple logger interface matching the original Python implementation
 */
export interface FastMCPLogger {
  readonly debug: (message: string) => Effect.Effect<void>
  readonly info: (message: string) => Effect.Effect<void>
  readonly warning: (message: string) => Effect.Effect<void>
  readonly error: (message: string) => Effect.Effect<void>
  readonly critical: (message: string) => Effect.Effect<void>
}

/**
 * Get a logger nested under FastMCP namespace.
 * 
 * @param name - the name of the logger, which will be prefixed with 'FastMCP.'
 * @returns a configured logger instance
 */
export const getLogger = (name: string): FastMCPLogger => {
  const loggerName = `FastMCP.${name}`
  
  return {
    debug: (message: string) => Logger.debug(message).pipe(Logger.withLoggerName(loggerName)),
    info: (message: string) => Logger.info(message).pipe(Logger.withLoggerName(loggerName)),
    warning: (message: string) => Logger.warning(message).pipe(Logger.withLoggerName(loggerName)),
    error: (message: string) => Logger.error(message).pipe(Logger.withLoggerName(loggerName)),
    critical: (message: string) => Logger.fatal(message).pipe(Logger.withLoggerName(loggerName)),
  }
}

/**
 * Configure logging for FastMCP.
 * 
 * @param level - the log level to use
 * @param enableRichTracebacks - whether to enable rich tracebacks (unused in TypeScript)
 */
export const configureLogging = (
  level: LogLevelType | LogLevel.LogLevel = "INFO",
  enableRichTracebacks: boolean = true
): Layer.Layer<never> => {
  const logLevel = typeof level === "string" ? LOG_LEVELS[level] : level
  
  return Logger.replace(
    Logger.defaultLogger,
    Logger.make(({ logLevel: msgLevel, message }) => {
      if (LogLevel.greaterThanOrEqualTo(msgLevel, logLevel)) {
        console.log(message)
      }
    })
  )
}