/**
 * FastMCP Transport Abstraction
 * 
 * This module provides the base transport interface and abstractions for MCP communication.
 * All transport implementations (stdio, HTTP, WebSocket, SSE) implement this interface.
 */

import { Effect, Stream, Scope, Context, Layer } from "effect"
import type {
  JSONRPCMessageUnion,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
} from "../types/protocol.js"
import type {
  TransportError,
  ConnectionError,
  TimeoutError,
  DisconnectedError,
} from "../errors/index.js"

/**
 * Transport configuration types
 */
export interface StdioTransportConfig {
  readonly type: "stdio"
}

export interface HttpTransportConfig {
  readonly type: "http"
  readonly host: string
  readonly port: number
  readonly path?: string
  readonly secure?: boolean
  readonly timeout?: number
  readonly headers?: Record<string, string>
}

export interface WebSocketTransportConfig {
  readonly type: "websocket"
  readonly url: string
  readonly protocols?: string[]
  readonly timeout?: number
  readonly reconnectDelay?: number
  readonly maxReconnectAttempts?: number
}

export interface SSETransportConfig {
  readonly type: "sse"
  readonly url: string
  readonly timeout?: number
  readonly reconnectDelay?: number
  readonly maxReconnectAttempts?: number
  readonly headers?: Record<string, string>
}

export type TransportConfig = 
  | StdioTransportConfig
  | HttpTransportConfig
  | WebSocketTransportConfig
  | SSETransportConfig

/**
 * Transport connection state
 */
export type TransportState = 
  | "disconnected"
  | "connecting" 
  | "connected"
  | "disconnecting"
  | "error"

/**
 * Transport statistics
 */
export interface TransportStats {
  readonly state: TransportState
  readonly connectedAt?: Date
  readonly messagesSent: number
  readonly messagesReceived: number
  readonly bytesTransferred: number
  readonly errors: number
  readonly lastError?: Error
}

/**
 * Transport events
 */
export interface TransportEvent {
  readonly type: "connected" | "disconnected" | "error" | "message"
  readonly timestamp: Date
  readonly data?: unknown
}

/**
 * Base Transport interface using Effect
 * 
 * All transport implementations must implement this interface to provide
 * type-safe, composable communication with proper resource management.
 */
export interface Transport {
  /**
   * Connect to the transport endpoint
   * Returns an Effect that succeeds when connection is established
   */
  readonly connect: Effect.Effect<void, TransportError | ConnectionError>
  
  /**
   * Disconnect from the transport endpoint
   * Always succeeds, cleaning up resources gracefully
   */
  readonly disconnect: Effect.Effect<void, never>
  
  /**
   * Send a message through the transport
   * Returns an Effect that succeeds when message is sent
   */
  readonly send: (message: JSONRPCMessageUnion) => Effect.Effect<void, TransportError>
  
  /**
   * Receive messages as a Stream
   * Stream continues until transport is disconnected or error occurs
   */
  readonly receive: Stream.Stream<JSONRPCMessageUnion, TransportError>
  
  /**
   * Get current transport state
   */
  readonly getState: Effect.Effect<TransportState, never>
  
  /**
   * Get transport statistics
   */
  readonly getStats: Effect.Effect<TransportStats, never>
  
  /**
   * Subscribe to transport events
   */
  readonly events: Stream.Stream<TransportEvent, never>
  
  /**
   * Check if transport is connected
   */
  readonly isConnected: Effect.Effect<boolean, never>
  
  /**
   * Wait for transport to be connected
   * Fails with timeout if connection doesn't happen within specified time
   */
  readonly waitForConnection: (timeoutMs?: number) => Effect.Effect<void, TimeoutError>
}

/**
 * Transport Context for dependency injection
 */
export const TransportContext = Context.GenericTag<Transport>("@fastmcp/core/Transport")

/**
 * Transport factory function type
 */
export type TransportFactory<TConfig extends TransportConfig> = (
  config: TConfig
) => Effect.Effect<Transport, never, Scope.Scope>

/**
 * Bidirectional Transport for client-server communication
 * 
 * This extends the base Transport with request-response patterns
 * and automatic correlation of responses with requests.
 */
export interface BidirectionalTransport extends Transport {
  /**
   * Send a request and wait for response
   * Automatically correlates response by ID
   */
  readonly request: <TResult = unknown>(
    request: JSONRPCRequest
  ) => Effect.Effect<JSONRPCResponse<TResult>, TransportError | TimeoutError>
  
  /**
   * Send a notification (no response expected)
   */
  readonly notify: (notification: JSONRPCNotification) => Effect.Effect<void, TransportError>
  
  /**
   * Stream of incoming requests (for servers)
   */
  readonly requests: Stream.Stream<JSONRPCRequest, TransportError>
  
  /**
   * Stream of incoming notifications
   */
  readonly notifications: Stream.Stream<JSONRPCNotification, TransportError>
}

/**
 * Transport message serializer interface
 */
export interface MessageSerializer {
  readonly serialize: (message: JSONRPCMessageUnion) => Effect.Effect<string | Uint8Array, Error>
  readonly deserialize: (data: string | Uint8Array) => Effect.Effect<JSONRPCMessageUnion, Error>
}

/**
 * JSON message serializer implementation
 */
export const JsonMessageSerializer: MessageSerializer = {
  serialize: (message) =>
    Effect.try({
      try: () => JSON.stringify(message),
      catch: (error) => new Error(`Failed to serialize message: ${String(error)}`),
    }),
  
  deserialize: (data) =>
    Effect.try({
      try: () => {
        const text = typeof data === "string" ? data : new TextDecoder().decode(data)
        return JSON.parse(text) as JSONRPCMessageUnion
      },
      catch: (error) => new Error(`Failed to deserialize message: ${String(error)}`),
    }),
}

/**
 * Transport connection manager
 * 
 * Provides automatic reconnection, connection pooling, and health checking
 */
export interface ConnectionManager {
  readonly connect: Effect.Effect<Transport, TransportError | ConnectionError, Scope.Scope>
  readonly disconnect: Effect.Effect<void, never>
  readonly getActiveConnections: Effect.Effect<readonly Transport[], never>
  readonly getHealthyConnections: Effect.Effect<readonly Transport[], never>
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  readonly minConnections: number
  readonly maxConnections: number
  readonly acquireTimeoutMs: number
  readonly idleTimeoutMs: number
  readonly healthCheckIntervalMs: number
  readonly reconnectDelayMs: number
  readonly maxReconnectAttempts: number
}

/**
 * Transport utilities
 */

/**
 * Create a Layer that provides a Transport from config
 */
export const createTransportLayer = <TConfig extends TransportConfig>(
  factory: TransportFactory<TConfig>,
  config: TConfig
): Layer.Layer<Transport, never> =>
  Layer.scoped(TransportContext, factory(config))

/**
 * Timeout a transport operation
 */
export const withTimeout = <A, E>(
  effect: Effect.Effect<A, E>,
  timeoutMs: number
): Effect.Effect<A, E | TimeoutError> =>
  Effect.race(
    effect,
    Effect.sleep(`${timeoutMs} millis`).pipe(
      Effect.flatMap(() => Effect.fail(new TimeoutError({
        message: `Operation timed out after ${timeoutMs}ms`,
        timeout: timeoutMs,
      })))
    )
  )

/**
 * Retry a transport operation with exponential backoff
 */
export const withRetry = <A, E>(
  effect: Effect.Effect<A, E>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Effect.Effect<A, E> =>
  Effect.retry(effect, {
    times: maxAttempts - 1,
    schedule: Effect.scheduleExponential(`${baseDelayMs} millis`),
  })

/**
 * Add logging to transport operations
 */
export const withLogging = <A, E>(
  effect: Effect.Effect<A, E>,
  operationName: string
): Effect.Effect<A, E> =>
  Effect.gen(function* () {
    yield* Effect.log(`Transport: Starting ${operationName}`)
    const start = Date.now()
    
    try {
      const result = yield* effect
      const duration = Date.now() - start
      yield* Effect.log(`Transport: ${operationName} completed in ${duration}ms`)
      return result
    } catch (error) {
      const duration = Date.now() - start
      yield* Effect.log(`Transport: ${operationName} failed after ${duration}ms: ${String(error)}`)
      throw error
    }
  })

/**
 * Health check for transport connections
 */
export const healthCheck = (transport: Transport): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    try {
      const isConnected = yield* transport.isConnected
      if (!isConnected) return false
      
      // Send a ping request to verify connection health
      const pingRequest: JSONRPCRequest = {
        jsonrpc: "2.0",
        method: "ping",
        id: `health-check-${Date.now()}`,
      }
      
      yield* transport.send(pingRequest).pipe(
        withTimeout(5000),
        Effect.catchAll(() => Effect.succeed(false))
      )
      
      return true
    } catch {
      return false
    }
  })

/**
 * Create a transport with automatic reconnection
 */
export const withAutoReconnect = <TConfig extends TransportConfig>(
  factory: TransportFactory<TConfig>,
  config: TConfig,
  reconnectConfig?: {
    maxAttempts?: number
    delayMs?: number
    exponentialBackoff?: boolean
  }
): Effect.Effect<Transport, never, Scope.Scope> =>
  Effect.gen(function* () {
    const { maxAttempts = 5, delayMs = 1000, exponentialBackoff = true } = reconnectConfig ?? {}
    
    let transport = yield* factory(config)
    let reconnectAttempts = 0
    
    // Monitor connection state and reconnect if needed
    const monitorConnection = Effect.gen(function* () {
      while (true) {
        const isHealthy = yield* healthCheck(transport)
        
        if (!isHealthy && reconnectAttempts < maxAttempts) {
          yield* Effect.log(`Transport: Connection unhealthy, attempting reconnect (${reconnectAttempts + 1}/${maxAttempts})`)
          
          yield* transport.disconnect
          
          const delay = exponentialBackoff 
            ? delayMs * Math.pow(2, reconnectAttempts)
            : delayMs
          
          yield* Effect.sleep(`${delay} millis`)
          
          try {
            transport = yield* factory(config)
            yield* transport.connect
            reconnectAttempts = 0
            yield* Effect.log("Transport: Reconnection successful")
          } catch (error) {
            reconnectAttempts++
            yield* Effect.log(`Transport: Reconnection failed: ${String(error)}`)
          }
        }
        
        yield* Effect.sleep("5000 millis") // Check every 5 seconds
      }
    })
    
    // Start monitoring in the background
    yield* Effect.fork(monitorConnection)
    
    return transport
  })

/**
 * Transport middleware type for composing transport behavior
 */
export type TransportMiddleware = (transport: Transport) => Transport

/**
 * Compose multiple transport middlewares
 */
export const composeMiddleware = (...middlewares: TransportMiddleware[]): TransportMiddleware =>
  (transport) => middlewares.reduce((acc, middleware) => middleware(acc), transport)

/**
 * Logging middleware for transports
 */
export const loggingMiddleware: TransportMiddleware = (transport) => ({
  ...transport,
  send: (message) => withLogging(transport.send(message), `send(${message.method ?? 'response'})`),
  connect: withLogging(transport.connect, "connect"),
  disconnect: withLogging(transport.disconnect, "disconnect"),
})

/**
 * Metrics middleware for transports
 */
export const metricsMiddleware: TransportMiddleware = (transport) => {
  let messagesSent = 0
  let messagesReceived = 0
  let bytesTransferred = 0
  
  return {
    ...transport,
    send: (message) =>
      Effect.gen(function* () {
        yield* transport.send(message)
        messagesSent++
        // Approximate bytes (JSON serialization)
        bytesTransferred += JSON.stringify(message).length
      }),
    
    receive: transport.receive.pipe(
      Stream.tap((message) =>
        Effect.sync(() => {
          messagesReceived++
          bytesTransferred += JSON.stringify(message).length
        })
      )
    ),
    
    getStats: Effect.gen(function* () {
      const baseStats = yield* transport.getStats
      return {
        ...baseStats,
        messagesSent,
        messagesReceived,
        bytesTransferred,
      }
    }),
  }
}

// Re-export transport implementations
export * from "./stdio.js"
export * from "./http.js"
export * from "./factory.js"