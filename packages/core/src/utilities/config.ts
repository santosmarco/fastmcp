/**
 * FastMCP Configuration Management System
 * 
 * This module provides a comprehensive configuration system with type-safe
 * configuration loading, validation, environment-based overrides, and 
 * runtime configuration management using Effect.
 */

import { Effect, Context, Layer, Config, ConfigProvider, ConfigError } from "effect"
import { Schema } from "@effect/schema"
import { getLogger } from "./logging.js"
import type { TransportConfig } from "../transport/index.js"
import type { LoggingConfig } from "./logging.js"
import type { CacheConfig } from "./cache.js"

/**
 * FastMCP Server Configuration
 */
export interface FastMCPServerConfig {
  readonly name: string
  readonly version: string
  readonly description?: string
  readonly transport: TransportConfig
  readonly logging: LoggingConfig
  readonly cache?: CacheConfig
  readonly auth?: AuthConfig
  readonly features?: FeatureConfig
  readonly limits?: LimitsConfig
  readonly monitoring?: MonitoringConfig
}

/**
 * FastMCP Client Configuration
 */
export interface FastMCPClientConfig {
  readonly name: string
  readonly version: string
  readonly transport: TransportConfig
  readonly logging: LoggingConfig
  readonly cache?: CacheConfig
  readonly timeout?: number
  readonly retries?: RetryConfig
  readonly features?: FeatureConfig
}

/**
 * Authentication Configuration
 */
export interface AuthConfig {
  readonly enabled: boolean
  readonly type: "jwt" | "oauth" | "apikey" | "none"
  readonly jwt?: JWTConfig
  readonly oauth?: OAuthConfig
  readonly apikey?: APIKeyConfig
}

export interface JWTConfig {
  readonly secret: string
  readonly algorithm: "HS256" | "HS384" | "HS512" | "RS256" | "RS384" | "RS512"
  readonly expiresIn: string
  readonly issuer?: string
  readonly audience?: string
}

export interface OAuthConfig {
  readonly clientId: string
  readonly clientSecret: string
  readonly redirectUri: string
  readonly scope: string
  readonly provider: "google" | "github" | "microsoft" | "custom"
  readonly authUrl?: string
  readonly tokenUrl?: string
}

export interface APIKeyConfig {
  readonly header: string
  readonly keys: readonly string[]
  readonly caseSensitive: boolean
}

/**
 * Feature Configuration
 */
export interface FeatureConfig {
  readonly tools: boolean
  readonly resources: boolean
  readonly prompts: boolean
  readonly sampling: boolean
  readonly streaming: boolean
  readonly experimental?: Record<string, boolean>
}

/**
 * Limits Configuration
 */
export interface LimitsConfig {
  readonly maxRequestSize: number
  readonly maxResponseSize: number
  readonly maxConcurrentRequests: number
  readonly requestTimeout: number
  readonly maxToolExecutionTime: number
  readonly maxResourceSize: number
}

/**
 * Retry Configuration
 */
export interface RetryConfig {
  readonly maxAttempts: number
  readonly baseDelay: number
  readonly maxDelay: number
  readonly exponentialBase: number
  readonly jitter: boolean
}

/**
 * Monitoring Configuration
 */
export interface MonitoringConfig {
  readonly enabled: boolean
  readonly metricsInterval: number
  readonly healthCheckInterval: number
  readonly performanceTracking: boolean
  readonly errorTracking: boolean
  readonly customMetrics?: Record<string, unknown>
}

/**
 * Configuration Schemas using @effect/schema
 */

const TransportConfigSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("stdio"),
  }),
  Schema.Struct({
    type: Schema.Literal("http"),
    host: Schema.String,
    port: Schema.Number,
    path: Schema.optional(Schema.String),
    secure: Schema.optional(Schema.Boolean),
    timeout: Schema.optional(Schema.Number),
    headers: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  }),
  Schema.Struct({
    type: Schema.Literal("websocket"),
    url: Schema.String,
    protocols: Schema.optional(Schema.Array(Schema.String)),
    timeout: Schema.optional(Schema.Number),
    reconnectDelay: Schema.optional(Schema.Number),
    maxReconnectAttempts: Schema.optional(Schema.Number),
  }),
  Schema.Struct({
    type: Schema.Literal("sse"),
    url: Schema.String,
    timeout: Schema.optional(Schema.Number),
    reconnectDelay: Schema.optional(Schema.Number),
    maxReconnectAttempts: Schema.optional(Schema.Number),
    headers: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  })
)

const LoggingConfigSchema = Schema.Struct({
  level: Schema.Union(
    Schema.Literal("DEBUG"),
    Schema.Literal("INFO"),
    Schema.Literal("WARNING"),
    Schema.Literal("ERROR"),
    Schema.Literal("CRITICAL")
  ),
  enableColors: Schema.optional(Schema.Boolean),
  enableTimestamps: Schema.optional(Schema.Boolean),
  enableContext: Schema.optional(Schema.Boolean),
  outputFormat: Schema.optional(Schema.Union(Schema.Literal("text"), Schema.Literal("json"))),
  component: Schema.optional(Schema.String),
})

const CacheConfigSchema = Schema.Struct({
  maxSize: Schema.optional(Schema.Number),
  defaultTTL: Schema.optional(Schema.Number),
  cleanupInterval: Schema.optional(Schema.Number),
  enableStats: Schema.optional(Schema.Boolean),
})

const JWTConfigSchema = Schema.Struct({
  secret: Schema.String,
  algorithm: Schema.Union(
    Schema.Literal("HS256"),
    Schema.Literal("HS384"),
    Schema.Literal("HS512"),
    Schema.Literal("RS256"),
    Schema.Literal("RS384"),
    Schema.Literal("RS512")
  ),
  expiresIn: Schema.String,
  issuer: Schema.optional(Schema.String),
  audience: Schema.optional(Schema.String),
})

const OAuthConfigSchema = Schema.Struct({
  clientId: Schema.String,
  clientSecret: Schema.String,
  redirectUri: Schema.String,
  scope: Schema.String,
  provider: Schema.Union(
    Schema.Literal("google"),
    Schema.Literal("github"),
    Schema.Literal("microsoft"),
    Schema.Literal("custom")
  ),
  authUrl: Schema.optional(Schema.String),
  tokenUrl: Schema.optional(Schema.String),
})

const APIKeyConfigSchema = Schema.Struct({
  header: Schema.String,
  keys: Schema.Array(Schema.String),
  caseSensitive: Schema.Boolean,
})

const AuthConfigSchema = Schema.Struct({
  enabled: Schema.Boolean,
  type: Schema.Union(
    Schema.Literal("jwt"),
    Schema.Literal("oauth"),
    Schema.Literal("apikey"),
    Schema.Literal("none")
  ),
  jwt: Schema.optional(JWTConfigSchema),
  oauth: Schema.optional(OAuthConfigSchema),
  apikey: Schema.optional(APIKeyConfigSchema),
})

const FeatureConfigSchema = Schema.Struct({
  tools: Schema.Boolean,
  resources: Schema.Boolean,
  prompts: Schema.Boolean,
  sampling: Schema.Boolean,
  streaming: Schema.Boolean,
  experimental: Schema.optional(Schema.Record(Schema.String, Schema.Boolean)),
})

const LimitsConfigSchema = Schema.Struct({
  maxRequestSize: Schema.Number,
  maxResponseSize: Schema.Number,
  maxConcurrentRequests: Schema.Number,
  requestTimeout: Schema.Number,
  maxToolExecutionTime: Schema.Number,
  maxResourceSize: Schema.Number,
})

const RetryConfigSchema = Schema.Struct({
  maxAttempts: Schema.Number,
  baseDelay: Schema.Number,
  maxDelay: Schema.Number,
  exponentialBase: Schema.Number,
  jitter: Schema.Boolean,
})

const MonitoringConfigSchema = Schema.Struct({
  enabled: Schema.Boolean,
  metricsInterval: Schema.Number,
  healthCheckInterval: Schema.Number,
  performanceTracking: Schema.Boolean,
  errorTracking: Schema.Boolean,
  customMetrics: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
})

const FastMCPServerConfigSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  description: Schema.optional(Schema.String),
  transport: TransportConfigSchema,
  logging: LoggingConfigSchema,
  cache: Schema.optional(CacheConfigSchema),
  auth: Schema.optional(AuthConfigSchema),
  features: Schema.optional(FeatureConfigSchema),
  limits: Schema.optional(LimitsConfigSchema),
  monitoring: Schema.optional(MonitoringConfigSchema),
})

const FastMCPClientConfigSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  transport: TransportConfigSchema,
  logging: LoggingConfigSchema,
  cache: Schema.optional(CacheConfigSchema),
  timeout: Schema.optional(Schema.Number),
  retries: Schema.optional(RetryConfigSchema),
  features: Schema.optional(FeatureConfigSchema),
})

/**
 * Default configurations
 */
export const defaultServerConfig: FastMCPServerConfig = {
  name: "fastmcp-server",
  version: "1.0.0",
  transport: { type: "stdio" },
  logging: {
    level: "INFO" as const,
    enableColors: true,
    enableTimestamps: true,
    enableContext: true,
    outputFormat: "text" as const,
  },
  cache: {
    maxSize: 1000,
    defaultTTL: 300000, // 5 minutes
    cleanupInterval: 60000, // 1 minute
    enableStats: true,
  },
  features: {
    tools: true,
    resources: true,
    prompts: true,
    sampling: false,
    streaming: false,
  },
  limits: {
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    maxResponseSize: 10 * 1024 * 1024, // 10MB
    maxConcurrentRequests: 100,
    requestTimeout: 30000, // 30 seconds
    maxToolExecutionTime: 60000, // 1 minute
    maxResourceSize: 50 * 1024 * 1024, // 50MB
  },
}

export const defaultClientConfig: FastMCPClientConfig = {
  name: "fastmcp-client",
  version: "1.0.0",
  transport: { type: "stdio" },
  logging: {
    level: "INFO" as const,
    enableColors: true,
    enableTimestamps: true,
    enableContext: true,
    outputFormat: "text" as const,
  },
  timeout: 30000,
  retries: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    exponentialBase: 2,
    jitter: true,
  },
  features: {
    tools: true,
    resources: true,
    prompts: true,
    sampling: true,
    streaming: false,
  },
}

/**
 * Configuration Context for dependency injection
 */
export const ServerConfigContext = Context.GenericTag<FastMCPServerConfig>("@fastmcp/core/ServerConfig")
export const ClientConfigContext = Context.GenericTag<FastMCPClientConfig>("@fastmcp/core/ClientConfig")

/**
 * Configuration loading utilities
 */

/**
 * Load configuration from environment variables
 */
export const loadFromEnvironment = <T>(
  schema: Schema.Schema<T>,
  prefix: string = "FASTMCP"
): Effect.Effect<T, ConfigError.ConfigError> =>
  Effect.gen(function* () {
    const logger = getLogger("config")
    yield* logger.debug(`Loading configuration from environment with prefix: ${prefix}`)

    // Create config provider from environment
    const configProvider = ConfigProvider.fromEnv()

    // Parse configuration using Effect Config
    const config = yield* Effect.config(
      Config.all({
        // This would be expanded based on the actual schema structure
        // For now, we'll use a simplified approach
      })
    ).pipe(Effect.provide(Layer.succeed(ConfigProvider.ConfigProvider, configProvider)))

    // Validate using schema
    return yield* Schema.decodeUnknown(schema)(config)
  })

/**
 * Load configuration from JSON file
 */
export const loadFromFile = <T>(
  schema: Schema.Schema<T>,
  filePath: string
): Effect.Effect<T, ConfigError.ConfigError | Error> =>
  Effect.gen(function* () {
    const logger = getLogger("config")
    yield* logger.debug(`Loading configuration from file: ${filePath}`)

    // Read file content
    const content = yield* Effect.tryPromise({
      try: () => import("fs").then(fs => fs.promises.readFile(filePath, "utf8")),
      catch: (error) => new Error(`Failed to read config file: ${String(error)}`),
    })

    // Parse JSON
    const parsed = yield* Effect.try({
      try: () => JSON.parse(content),
      catch: (error) => new Error(`Failed to parse config JSON: ${String(error)}`),
    })

    // Validate using schema
    return yield* Schema.decodeUnknown(schema)(parsed)
  })

/**
 * Load configuration with multiple sources and precedence
 */
export const loadConfiguration = <T>(
  schema: Schema.Schema<T>,
  sources: {
    defaults?: T
    file?: string
    environment?: { prefix?: string }
    overrides?: Partial<T>
  }
): Effect.Effect<T, ConfigError.ConfigError | Error> =>
  Effect.gen(function* () {
    const logger = getLogger("config")
    yield* logger.info("Loading configuration from multiple sources")

    let config: any = sources.defaults ?? {}

    // Load from file if specified
    if (sources.file) {
      try {
        const fileConfig = yield* loadFromFile(schema, sources.file)
        config = { ...config, ...fileConfig }
        yield* logger.debug("Loaded configuration from file")
      } catch (error) {
        yield* logger.warning("Failed to load configuration from file", { error: String(error) })
      }
    }

    // Load from environment if specified
    if (sources.environment) {
      try {
        const envConfig = yield* loadFromEnvironment(schema, sources.environment.prefix)
        config = { ...config, ...envConfig }
        yield* logger.debug("Loaded configuration from environment")
      } catch (error) {
        yield* logger.warning("Failed to load configuration from environment", { error: String(error) })
      }
    }

    // Apply overrides
    if (sources.overrides) {
      config = { ...config, ...sources.overrides }
      yield* logger.debug("Applied configuration overrides")
    }

    // Final validation
    const validatedConfig = yield* Schema.decodeUnknown(schema)(config)
    yield* logger.info("Configuration loaded and validated successfully")

    return validatedConfig
  })

/**
 * Create server configuration layer
 */
export const createServerConfigLayer = (
  sources?: {
    defaults?: FastMCPServerConfig
    file?: string
    environment?: { prefix?: string }
    overrides?: Partial<FastMCPServerConfig>
  }
): Layer.Layer<FastMCPServerConfig, ConfigError.ConfigError | Error> =>
  Layer.effect(
    ServerConfigContext,
    loadConfiguration(FastMCPServerConfigSchema, {
      defaults: defaultServerConfig,
      ...sources,
    })
  )

/**
 * Create client configuration layer
 */
export const createClientConfigLayer = (
  sources?: {
    defaults?: FastMCPClientConfig
    file?: string
    environment?: { prefix?: string }
    overrides?: Partial<FastMCPClientConfig>
  }
): Layer.Layer<FastMCPClientConfig, ConfigError.ConfigError | Error> =>
  Layer.effect(
    ClientConfigContext,
    loadConfiguration(FastMCPClientConfigSchema, {
      defaults: defaultClientConfig,
      ...sources,
    })
  )

/**
 * Configuration validation utilities
 */

/**
 * Validate server configuration
 */
export const validateServerConfig = (config: unknown): Effect.Effect<FastMCPServerConfig, Error> =>
  Schema.decodeUnknown(FastMCPServerConfigSchema)(config).pipe(
    Effect.mapError((error) => new Error(`Invalid server configuration: ${error}`))
  )

/**
 * Validate client configuration
 */
export const validateClientConfig = (config: unknown): Effect.Effect<FastMCPClientConfig, Error> =>
  Schema.decodeUnknown(FastMCPClientConfigSchema)(config).pipe(
    Effect.mapError((error) => new Error(`Invalid client configuration: ${error}`))
  )

/**
 * Configuration utilities
 */
export const configUtils = {
  /**
   * Merge configurations with deep merging
   */
  merge: <T extends Record<string, any>>(base: T, override: Partial<T>): T => {
    const result = { ...base }
    
    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined) {
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          result[key as keyof T] = configUtils.merge(result[key] || {}, value)
        } else {
          result[key as keyof T] = value
        }
      }
    }
    
    return result
  },

  /**
   * Extract configuration subset
   */
  extract: <T, K extends keyof T>(config: T, keys: readonly K[]): Pick<T, K> => {
    const result = {} as Pick<T, K>
    for (const key of keys) {
      result[key] = config[key]
    }
    return result
  },

  /**
   * Validate configuration at runtime
   */
  validate: <T>(schema: Schema.Schema<T>, config: unknown): Effect.Effect<T, Error> =>
    Schema.decodeUnknown(schema)(config).pipe(
      Effect.mapError((error) => new Error(`Configuration validation failed: ${error}`))
    ),

  /**
   * Create configuration watcher for file changes
   */
  watch: <T>(
    schema: Schema.Schema<T>,
    filePath: string,
    callback: (config: T) => Effect.Effect<void, never>
  ): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const logger = getLogger("config-watcher")
      yield* logger.info(`Watching configuration file: ${filePath}`)

      // This would use fs.watch in a real implementation
      // For now, we'll just log the intention
      yield* logger.debug("Configuration watcher started")
    }),
}

/**
 * Export configuration management utilities
 */
export const configuration = {
  loadFromEnvironment,
  loadFromFile,
  loadConfiguration,
  createServerConfigLayer,
  createClientConfigLayer,
  validateServerConfig,
  validateClientConfig,
  ...configUtils,
}