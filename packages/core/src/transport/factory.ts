/**
 * Transport Factory for FastMCP
 * 
 * This module provides a unified factory for creating different types of transports
 * based on configuration. It handles the complexity of instantiating the correct
 * transport implementation and provides type-safe configuration.
 */

import { Effect, Scope, Match } from "effect"
import type {
  Transport,
  TransportConfig,
  TransportFactory,
  StdioTransportConfig,
  HttpTransportConfig,
  WebSocketTransportConfig,
  SSETransportConfig,
} from "./index.js"
import { createStdioTransport, createConnectedStdioTransport } from "./stdio.js"
import { createHttpTransport, createConnectedHttpTransport } from "./http.js"
import { ConfigurationError } from "../errors/index.js"

/**
 * Transport factory options
 */
export interface TransportFactoryOptions {
  readonly autoConnect?: boolean
  readonly middleware?: readonly TransportMiddleware[]
}

/**
 * Transport middleware function
 */
export type TransportMiddleware = (transport: Transport) => Transport

/**
 * Create a transport based on configuration
 */
export const createTransport = (
  config: TransportConfig,
  options?: TransportFactoryOptions
): Effect.Effect<Transport, ConfigurationError, Scope.Scope> =>
  Effect.gen(function* () {
    const { autoConnect = false, middleware = [] } = options ?? {}

    // Create the base transport based on type
    const baseTransport = yield* Match.value(config).pipe(
      Match.when({ type: "stdio" }, (config) => 
        autoConnect 
          ? createConnectedStdioTransport(config).pipe(
              Effect.mapError(() => new ConfigurationError({
                message: "Failed to create connected stdio transport",
                key: "transport.type",
                value: "stdio",
              }))
            )
          : createStdioTransport(config)
      ),
      Match.when({ type: "http" }, (config) =>
        autoConnect
          ? createConnectedHttpTransport(config).pipe(
              Effect.mapError(() => new ConfigurationError({
                message: "Failed to create connected HTTP transport",
                key: "transport.type", 
                value: "http",
              }))
            )
          : createHttpTransport(config)
      ),
      Match.when({ type: "websocket" }, (config) =>
        Effect.fail(new ConfigurationError({
          message: "WebSocket transport not yet implemented",
          key: "transport.type",
          value: "websocket",
        }))
      ),
      Match.when({ type: "sse" }, (config) =>
        Effect.fail(new ConfigurationError({
          message: "SSE transport not yet implemented", 
          key: "transport.type",
          value: "sse",
        }))
      ),
      Match.exhaustive
    )

    // Apply middleware in order
    const enhancedTransport = middleware.reduce(
      (transport, middlewareFunc) => middlewareFunc(transport),
      baseTransport
    )

    return enhancedTransport
  })

/**
 * Create a connected transport (convenience function)
 */
export const createConnectedTransport = (
  config: TransportConfig,
  options?: Omit<TransportFactoryOptions, 'autoConnect'>
): Effect.Effect<Transport, ConfigurationError, Scope.Scope> =>
  createTransport(config, { ...options, autoConnect: true })

/**
 * Transport registry for custom transport types
 */
export class TransportRegistry {
  private readonly factories = new Map<string, TransportFactory<any>>()

  /**
   * Register a custom transport factory
   */
  register<TConfig extends TransportConfig>(
    type: TConfig["type"],
    factory: TransportFactory<TConfig>
  ): void {
    this.factories.set(type, factory)
  }

  /**
   * Create a transport using registered factories
   */
  create(config: TransportConfig): Effect.Effect<Transport, ConfigurationError, Scope.Scope> {
    const factory = this.factories.get(config.type)
    
    if (!factory) {
      return Effect.fail(new ConfigurationError({
        message: `Unknown transport type: ${config.type}`,
        key: "transport.type",
        value: config.type,
      }))
    }

    return factory(config).pipe(
      Effect.mapError(() => new ConfigurationError({
        message: `Failed to create transport of type: ${config.type}`,
        key: "transport.type",
        value: config.type,
      }))
    )
  }

  /**
   * Get all registered transport types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.factories.keys())
  }

  /**
   * Check if a transport type is registered
   */
  isRegistered(type: string): boolean {
    return this.factories.has(type)
  }
}

/**
 * Default transport registry instance
 */
export const defaultTransportRegistry = new TransportRegistry()

// Register built-in transports
defaultTransportRegistry.register("stdio", createStdioTransport)
defaultTransportRegistry.register("http", createHttpTransport)

/**
 * Create transport using the default registry
 */
export const createTransportFromRegistry = (
  config: TransportConfig,
  options?: TransportFactoryOptions
): Effect.Effect<Transport, ConfigurationError, Scope.Scope> =>
  Effect.gen(function* () {
    const { autoConnect = false, middleware = [] } = options ?? {}
    
    const baseTransport = yield* defaultTransportRegistry.create(config)
    
    if (autoConnect) {
      yield* baseTransport.connect.pipe(
        Effect.mapError(() => new ConfigurationError({
          message: `Failed to connect transport of type: ${config.type}`,
          key: "transport.connection",
          value: config.type,
        }))
      )
    }

    // Apply middleware
    const enhancedTransport = middleware.reduce(
      (transport, middlewareFunc) => middlewareFunc(transport),
      baseTransport
    )

    return enhancedTransport
  })

/**
 * Configuration validation helpers
 */

/**
 * Validate transport configuration
 */
export const validateTransportConfig = (config: unknown): Effect.Effect<TransportConfig, ConfigurationError> =>
  Effect.gen(function* () {
    if (!config || typeof config !== "object") {
      yield* Effect.fail(new ConfigurationError({
        message: "Transport config must be an object",
        key: "transport",
        value: config,
      }))
    }

    const { type } = config as any

    if (!type || typeof type !== "string") {
      yield* Effect.fail(new ConfigurationError({
        message: "Transport config must have a 'type' property",
        key: "transport.type",
        value: type,
      }))
    }

    // Validate specific transport configurations
    return yield* Match.value(type).pipe(
      Match.when("stdio", () => validateStdioConfig(config)),
      Match.when("http", () => validateHttpConfig(config)),
      Match.when("websocket", () => validateWebSocketConfig(config)),
      Match.when("sse", () => validateSSEConfig(config)),
      Match.orElse(() => Effect.fail(new ConfigurationError({
        message: `Unknown transport type: ${type}`,
        key: "transport.type",
        value: type,
      })))
    )
  })

/**
 * Validate stdio transport configuration
 */
const validateStdioConfig = (config: unknown): Effect.Effect<StdioTransportConfig, ConfigurationError> =>
  Effect.succeed({ type: "stdio" })

/**
 * Validate HTTP transport configuration
 */
const validateHttpConfig = (config: unknown): Effect.Effect<HttpTransportConfig, ConfigurationError> =>
  Effect.gen(function* () {
    const { host, port, path, secure, timeout, headers } = config as any

    if (!host || typeof host !== "string") {
      yield* Effect.fail(new ConfigurationError({
        message: "HTTP transport requires a 'host' property",
        key: "transport.host",
        value: host,
      }))
    }

    if (!port || typeof port !== "number" || port < 1 || port > 65535) {
      yield* Effect.fail(new ConfigurationError({
        message: "HTTP transport requires a valid 'port' property (1-65535)",
        key: "transport.port",
        value: port,
      }))
    }

    return {
      type: "http",
      host,
      port,
      ...(path && { path }),
      ...(typeof secure === "boolean" && { secure }),
      ...(typeof timeout === "number" && { timeout }),
      ...(headers && typeof headers === "object" && { headers }),
    }
  })

/**
 * Validate WebSocket transport configuration
 */
const validateWebSocketConfig = (config: unknown): Effect.Effect<WebSocketTransportConfig, ConfigurationError> =>
  Effect.gen(function* () {
    const { url, protocols, timeout, reconnectDelay, maxReconnectAttempts } = config as any

    if (!url || typeof url !== "string") {
      yield* Effect.fail(new ConfigurationError({
        message: "WebSocket transport requires a 'url' property",
        key: "transport.url",
        value: url,
      }))
    }

    try {
      new URL(url)
    } catch {
      yield* Effect.fail(new ConfigurationError({
        message: "WebSocket transport requires a valid URL",
        key: "transport.url",
        value: url,
      }))
    }

    return {
      type: "websocket",
      url,
      ...(Array.isArray(protocols) && { protocols }),
      ...(typeof timeout === "number" && { timeout }),
      ...(typeof reconnectDelay === "number" && { reconnectDelay }),
      ...(typeof maxReconnectAttempts === "number" && { maxReconnectAttempts }),
    }
  })

/**
 * Validate SSE transport configuration
 */
const validateSSEConfig = (config: unknown): Effect.Effect<SSETransportConfig, ConfigurationError> =>
  Effect.gen(function* () {
    const { url, timeout, reconnectDelay, maxReconnectAttempts, headers } = config as any

    if (!url || typeof url !== "string") {
      yield* Effect.fail(new ConfigurationError({
        message: "SSE transport requires a 'url' property",
        key: "transport.url",
        value: url,
      }))
    }

    try {
      new URL(url)
    } catch {
      yield* Effect.fail(new ConfigurationError({
        message: "SSE transport requires a valid URL",
        key: "transport.url",
        value: url,
      }))
    }

    return {
      type: "sse",
      url,
      ...(typeof timeout === "number" && { timeout }),
      ...(typeof reconnectDelay === "number" && { reconnectDelay }),
      ...(typeof maxReconnectAttempts === "number" && { maxReconnectAttempts }),
      ...(headers && typeof headers === "object" && { headers }),
    }
  })

/**
 * Transport configuration builders
 */
export const transportConfigs = {
  stdio: (): StdioTransportConfig => ({ type: "stdio" }),
  
  http: (host: string, port: number, options?: {
    path?: string
    secure?: boolean
    timeout?: number
    headers?: Record<string, string>
  }): HttpTransportConfig => ({
    type: "http",
    host,
    port,
    ...options,
  }),

  websocket: (url: string, options?: {
    protocols?: string[]
    timeout?: number
    reconnectDelay?: number
    maxReconnectAttempts?: number
  }): WebSocketTransportConfig => ({
    type: "websocket",
    url,
    ...options,
  }),

  sse: (url: string, options?: {
    timeout?: number
    reconnectDelay?: number
    maxReconnectAttempts?: number
    headers?: Record<string, string>
  }): SSETransportConfig => ({
    type: "sse",
    url,
    ...options,
  }),
}

/**
 * Common middleware implementations
 */
export const commonMiddleware = {
  /**
   * Logging middleware
   */
  logging: (): TransportMiddleware => (transport) => ({
    ...transport,
    connect: transport.connect.pipe(
      Effect.tap(() => Effect.log("Transport: Connecting...")),
      Effect.tapError((error) => Effect.log(`Transport: Connection failed - ${String(error)}`)),
      Effect.tap(() => Effect.log("Transport: Connected"))
    ),
    disconnect: transport.disconnect.pipe(
      Effect.tap(() => Effect.log("Transport: Disconnecting...")),
      Effect.tap(() => Effect.log("Transport: Disconnected"))
    ),
    send: (message) => transport.send(message).pipe(
      Effect.tap(() => Effect.log(`Transport: Sent message - ${message.method ?? 'response'}`)),
      Effect.tapError((error) => Effect.log(`Transport: Send failed - ${String(error)}`))
    ),
  }),

  /**
   * Retry middleware with exponential backoff
   */
  retry: (maxAttempts: number = 3, baseDelayMs: number = 1000): TransportMiddleware => (transport) => ({
    ...transport,
    connect: transport.connect.pipe(
      Effect.retry({
        times: maxAttempts - 1,
        schedule: Effect.scheduleExponential(`${baseDelayMs} millis`),
      })
    ),
    send: (message) => transport.send(message).pipe(
      Effect.retry({
        times: maxAttempts - 1,
        schedule: Effect.scheduleExponential(`${baseDelayMs} millis`),
      })
    ),
  }),

  /**
   * Timeout middleware
   */
  timeout: (timeoutMs: number): TransportMiddleware => (transport) => ({
    ...transport,
    connect: transport.connect.pipe(Effect.timeout(`${timeoutMs} millis`)),
    send: (message) => transport.send(message).pipe(Effect.timeout(`${timeoutMs} millis`)),
  }),
}