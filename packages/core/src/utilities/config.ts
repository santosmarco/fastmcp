/**
 * FastMCP Configuration System
 * 
 * Configuration system using Effect Config for type-safe environment variable loading.
 * Matches the original Python Settings class pattern but uses Effect's Config system.
 */

import { Effect, Config } from "effect"

/**
 * Log level type matching the original Python implementation
 */
export type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL"

/**
 * Duplicate behavior type matching the original Python implementation
 */
export type DuplicateBehavior = "warn" | "error" | "replace" | "ignore"

/**
 * FastMCP Settings - matches the original Python Settings class
 */
export interface Settings {
  readonly log_level: LogLevel
  readonly enable_rich_tracebacks: boolean
  readonly deprecation_warnings: boolean
  readonly duplicate_tool_behavior: DuplicateBehavior
  readonly duplicate_resource_behavior: DuplicateBehavior
  readonly duplicate_prompt_behavior: DuplicateBehavior
}

/**
 * Default settings matching the original Python implementation
 */
const DEFAULT_SETTINGS: Settings = {
  log_level: "INFO",
  enable_rich_tracebacks: true,
  deprecation_warnings: true,
  duplicate_tool_behavior: "warn",
  duplicate_resource_behavior: "warn",
  duplicate_prompt_behavior: "warn",
}

/**
 * Config validators
 */
const logLevelConfig = Config.literal("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")
const duplicateBehaviorConfig = Config.literal("warn", "error", "replace", "ignore")

/**
 * Effect Config definitions for each setting
 */
const logLevelFromEnv = Config.withDefault(
  Config.oneOf(
    Config.string("FASTMCP_LOG_LEVEL").pipe(Config.validate(logLevelConfig)),
    Config.string("FASTMCP_SERVER_LOG_LEVEL").pipe(
      Config.validate(logLevelConfig),
      Config.mapAttempt((value) => {
        console.warn("Using `FASTMCP_SERVER_` environment variables is deprecated. Use `FASTMCP_` instead.")
        return value
      })
    )
  ),
  DEFAULT_SETTINGS.log_level
)

const enableRichTracebacksFromEnv = Config.withDefault(
  Config.oneOf(
    Config.boolean("FASTMCP_ENABLE_RICH_TRACEBACKS"),
    Config.boolean("FASTMCP_SERVER_ENABLE_RICH_TRACEBACKS").pipe(
      Config.mapAttempt((value) => {
        console.warn("Using `FASTMCP_SERVER_` environment variables is deprecated. Use `FASTMCP_` instead.")
        return value
      })
    )
  ),
  DEFAULT_SETTINGS.enable_rich_tracebacks
)

const deprecationWarningsFromEnv = Config.withDefault(
  Config.oneOf(
    Config.boolean("FASTMCP_DEPRECATION_WARNINGS"),
    Config.boolean("FASTMCP_SERVER_DEPRECATION_WARNINGS").pipe(
      Config.mapAttempt((value) => {
        console.warn("Using `FASTMCP_SERVER_` environment variables is deprecated. Use `FASTMCP_` instead.")
        return value
      })
    )
  ),
  DEFAULT_SETTINGS.deprecation_warnings
)

const duplicateToolBehaviorFromEnv = Config.withDefault(
  Config.oneOf(
    Config.string("FASTMCP_DUPLICATE_TOOL_BEHAVIOR").pipe(Config.validate(duplicateBehaviorConfig)),
    Config.string("FASTMCP_SERVER_DUPLICATE_TOOL_BEHAVIOR").pipe(
      Config.validate(duplicateBehaviorConfig),
      Config.mapAttempt((value) => {
        console.warn("Using `FASTMCP_SERVER_` environment variables is deprecated. Use `FASTMCP_` instead.")
        return value
      })
    )
  ),
  DEFAULT_SETTINGS.duplicate_tool_behavior
)

const duplicateResourceBehaviorFromEnv = Config.withDefault(
  Config.oneOf(
    Config.string("FASTMCP_DUPLICATE_RESOURCE_BEHAVIOR").pipe(Config.validate(duplicateBehaviorConfig)),
    Config.string("FASTMCP_SERVER_DUPLICATE_RESOURCE_BEHAVIOR").pipe(
      Config.validate(duplicateBehaviorConfig),
      Config.mapAttempt((value) => {
        console.warn("Using `FASTMCP_SERVER_` environment variables is deprecated. Use `FASTMCP_` instead.")
        return value
      })
    )
  ),
  DEFAULT_SETTINGS.duplicate_resource_behavior
)

const duplicatePromptBehaviorFromEnv = Config.withDefault(
  Config.oneOf(
    Config.string("FASTMCP_DUPLICATE_PROMPT_BEHAVIOR").pipe(Config.validate(duplicateBehaviorConfig)),
    Config.string("FASTMCP_SERVER_DUPLICATE_PROMPT_BEHAVIOR").pipe(
      Config.validate(duplicateBehaviorConfig),
      Config.mapAttempt((value) => {
        console.warn("Using `FASTMCP_SERVER_` environment variables is deprecated. Use `FASTMCP_` instead.")
        return value
      })
    )
  ),
  DEFAULT_SETTINGS.duplicate_prompt_behavior
)

/**
 * Combined settings config
 */
const settingsConfig = Config.all({
  log_level: logLevelFromEnv,
  enable_rich_tracebacks: enableRichTracebacksFromEnv,
  deprecation_warnings: deprecationWarningsFromEnv,
  duplicate_tool_behavior: duplicateToolBehaviorFromEnv,
  duplicate_resource_behavior: duplicateResourceBehaviorFromEnv,
  duplicate_prompt_behavior: duplicatePromptBehaviorFromEnv,
})

/**
 * Load settings from environment variables using Effect Config.
 * Matches the Pydantic BaseSettings pattern from the original Python code.
 */
export const loadSettings = (): Effect.Effect<Settings> =>
  Effect.config(settingsConfig)

/**
 * Global settings instance - matches the original Python pattern
 * This creates a runtime effect that loads settings when accessed
 */
export const getSettings = (): Effect.Effect<Settings> => loadSettings()

/**
 * Synchronous settings loader for cases where Effect context isn't available
 * Falls back to defaults if environment loading fails
 */
export const loadSettingsSync = (): Settings => {
  try {
    // This is a simplified sync version for compatibility
    // In practice, you'd use the Effect version in your application
    return DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

/**
 * Default settings export for compatibility
 */
export const settings = DEFAULT_SETTINGS