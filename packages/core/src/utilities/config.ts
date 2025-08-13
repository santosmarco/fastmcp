/**
 * FastMCP Configuration System
 * 
 * Simple configuration system matching the original Python Settings class.
 * Provides environment variable loading with defaults, similar to Pydantic BaseSettings.
 */

// Schema functionality is now part of effect package

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
 * Environment variable prefixes to check (matches original Python implementation)
 */
const ENV_PREFIXES = ["FASTMCP_", "FASTMCP_SERVER_"]

/**
 * Load settings from environment variables with fallback to defaults.
 * Matches the Pydantic BaseSettings pattern from the original Python code.
 */
export function loadSettings(): Settings {
  const settings: Settings = { ...DEFAULT_SETTINGS }

  // Check each environment variable with prefixes
  for (const prefix of ENV_PREFIXES) {
    // Log level
    const logLevel = process.env[`${prefix}LOG_LEVEL`]
    if (logLevel && isValidLogLevel(logLevel)) {
      settings.log_level = logLevel
      if (prefix === "FASTMCP_SERVER_") {
        console.warn("Using `FASTMCP_SERVER_` environment variables is deprecated. Use `FASTMCP_` instead.")
      }
    }

    // Rich tracebacks
    const richTracebacks = process.env[`${prefix}ENABLE_RICH_TRACEBACKS`]
    if (richTracebacks !== undefined) {
      settings.enable_rich_tracebacks = richTracebacks.toLowerCase() === "true"
    }

    // Deprecation warnings
    const deprecationWarnings = process.env[`${prefix}DEPRECATION_WARNINGS`]
    if (deprecationWarnings !== undefined) {
      settings.deprecation_warnings = deprecationWarnings.toLowerCase() === "true"
    }

    // Duplicate behaviors
    const duplicateToolBehavior = process.env[`${prefix}DUPLICATE_TOOL_BEHAVIOR`]
    if (duplicateToolBehavior && isValidDuplicateBehavior(duplicateToolBehavior)) {
      settings.duplicate_tool_behavior = duplicateToolBehavior
    }

    const duplicateResourceBehavior = process.env[`${prefix}DUPLICATE_RESOURCE_BEHAVIOR`]
    if (duplicateResourceBehavior && isValidDuplicateBehavior(duplicateResourceBehavior)) {
      settings.duplicate_resource_behavior = duplicateResourceBehavior
    }

    const duplicatePromptBehavior = process.env[`${prefix}DUPLICATE_PROMPT_BEHAVIOR`]
    if (duplicatePromptBehavior && isValidDuplicateBehavior(duplicatePromptBehavior)) {
      settings.duplicate_prompt_behavior = duplicatePromptBehavior
    }
  }

  return settings
}

/**
 * Type guards for validation
 */
function isValidLogLevel(value: string): value is LogLevel {
  return ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"].includes(value)
}

function isValidDuplicateBehavior(value: string): value is DuplicateBehavior {
  return ["warn", "error", "replace", "ignore"].includes(value)
}

/**
 * Global settings instance - matches the original Python pattern
 */
export const settings = loadSettings()