/**
 * HTTP Transport Implementation for FastMCP
 * 
 * This transport implementation handles communication over HTTP,
 * supporting both client and server-side HTTP communication for MCP.
 */

import { Effect, Stream, Scope, Queue, Ref, pipe } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform"
import type {
  Transport,
  TransportConfig,
  TransportState,
  TransportStats,
  TransportEvent,
  MessageSerializer,
  JsonMessageSerializer,
  HttpTransportConfig,
} from "./index.js"
import type { JSONRPCMessageUnion, JSONRPCRequest, JSONRPCResponse } from "../types/protocol.js"
import {
  TransportError,
  ConnectionError,
  TimeoutError,
  DisconnectedError,
} from "../errors/index.js"

/**
 * HTTP Transport Implementation
 */
export class HttpTransport implements Transport {
  private readonly config: HttpTransportConfig
  private readonly serializer: MessageSerializer
  private readonly state: Ref.Ref<TransportState>
  private readonly stats: Ref.Ref<TransportStats>
  private readonly eventQueue: Queue.Queue<TransportEvent>
  private readonly messageQueue: Queue.Queue<JSONRPCMessageUnion>
  private readonly httpClient: HttpClient.HttpClient

  constructor(
    config: HttpTransportConfig,
    serializer: MessageSerializer = JsonMessageSerializer
  ) {
    this.config = config
    this.serializer = serializer
    this.state = Ref.unsafeMake<TransportState>("disconnected")
    this.eventQueue = Queue.unbounded<TransportEvent>()
    this.messageQueue = Queue.unbounded<JSONRPCMessageUnion>()
    this.httpClient = HttpClient.make()
    this.stats = Ref.unsafeMake<TransportStats>({
      state: "disconnected",
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      errors: 0,
    })
  }

  readonly connect: Effect.Effect<void, TransportError | ConnectionError> = Effect.gen(
    function* () {
      const currentState = yield* Ref.get(this.state)
      
      if (currentState === "connected") {
        return
      }
      
      if (currentState === "connecting") {
        yield* this.waitForConnection()
        return
      }

      yield* Ref.set(this.state, "connecting")
      
      try {
        // Test connection with a health check
        yield* this.performHealthCheck()

        yield* Ref.set(this.state, "connected")
        yield* Ref.update(this.stats, (stats) => ({
          ...stats,
          state: "connected",
          connectedAt: new Date(),
        }))

        // Emit connected event
        yield* Queue.offer(this.eventQueue, {
          type: "connected",
          timestamp: new Date(),
        })

        yield* Effect.log(`HTTP transport connected to ${this.getBaseUrl()}`)
      } catch (error) {
        yield* Ref.set(this.state, "error")
        yield* this.handleError(error as Error)
        yield* Effect.fail(
          new ConnectionError({
            message: `Failed to connect HTTP transport: ${String(error)}`,
            endpoint: this.getBaseUrl(),
            cause: error,
          })
        )
      }
    }.bind(this)
  )

  readonly disconnect: Effect.Effect<void, never> = Effect.gen(
    function* () {
      const currentState = yield* Ref.get(this.state)
      
      if (currentState === "disconnected") {
        return
      }

      yield* Ref.set(this.state, "disconnecting")

      try {
        yield* Queue.shutdown(this.messageQueue)
        
        yield* Ref.set(this.state, "disconnected")
        yield* Ref.update(this.stats, (stats) => ({
          ...stats,
          state: "disconnected",
        }))

        // Emit disconnected event
        yield* Queue.offer(this.eventQueue, {
          type: "disconnected",
          timestamp: new Date(),
        })

        yield* Effect.log("HTTP transport disconnected")
      } catch (error) {
        yield* Effect.log(`Error during HTTP transport disconnect: ${String(error)}`)
      }
    }.bind(this)
  )

  readonly send = (message: JSONRPCMessageUnion): Effect.Effect<void, TransportError> =>
    Effect.gen(function* () {
      const currentState = yield* Ref.get(this.state)
      
      if (currentState !== "connected") {
        yield* Effect.fail(
          new TransportError({
            message: `Cannot send message, transport state is: ${currentState}`,
            transportType: "http",
          })
        )
      }

      try {
        const serialized = yield* this.serializer.serialize(message)
        const body = typeof serialized === "string" ? serialized : new TextDecoder().decode(serialized)
        
        const request = HttpClientRequest.post(this.getBaseUrl()).pipe(
          HttpClientRequest.setHeader("Content-Type", "application/json"),
          HttpClientRequest.setHeader("Accept", "application/json"),
          this.addCustomHeaders,
          HttpClientRequest.setBody(body)
        )

        const response = yield* this.httpClient.execute(request).pipe(
          Effect.timeout(`${this.config.timeout ?? 30000} millis`)
        )

        // Handle response for request messages (expect JSON-RPC response)
        if ("id" in message && message.id !== undefined) {
          const responseBody = yield* HttpClientResponse.text(response)
          if (responseBody.trim()) {
            const responseMessage = yield* this.serializer.deserialize(responseBody)
            yield* Queue.offer(this.messageQueue, responseMessage)
          }
        }
        
        // Update stats
        yield* Ref.update(this.stats, (stats) => ({
          ...stats,
          messagesSent: stats.messagesSent + 1,
          bytesTransferred: stats.bytesTransferred + body.length,
        }))

        yield* Effect.log(`HTTP transport sent message: ${message.method ?? 'response'}`)
      } catch (error) {
        yield* this.handleError(error as Error)
        yield* Effect.fail(
          new TransportError({
            message: `Failed to send message via HTTP: ${String(error)}`,
            transportType: "http",
            cause: error,
          })
        )
      }
    }.bind(this))

  readonly receive: Stream.Stream<JSONRPCMessageUnion, TransportError> = Stream.fromQueue(
    this.messageQueue
  ).pipe(
    Stream.mapError((error) => 
      new TransportError({
        message: `Error receiving message from HTTP: ${String(error)}`,
        transportType: "http",
        cause: error,
      })
    )
  )

  readonly getState: Effect.Effect<TransportState, never> = Ref.get(this.state)

  readonly getStats: Effect.Effect<TransportStats, never> = Ref.get(this.stats)

  readonly events: Stream.Stream<TransportEvent, never> = Stream.fromQueue(this.eventQueue)

  readonly isConnected: Effect.Effect<boolean, never> = Effect.gen(function* () {
    const state = yield* Ref.get(this.state)
    return state === "connected"
  }.bind(this))

  readonly waitForConnection = (timeoutMs: number = 10000): Effect.Effect<void, TimeoutError> =>
    Effect.gen(function* () {
      const startTime = Date.now()
      
      while (true) {
        const state = yield* Ref.get(this.state)
        
        if (state === "connected") {
          return
        }
        
        if (state === "error") {
          yield* Effect.fail(
            new TimeoutError({
              message: "Transport connection failed",
              timeout: timeoutMs,
            })
          )
        }
        
        if (Date.now() - startTime > timeoutMs) {
          yield* Effect.fail(
            new TimeoutError({
              message: `Connection timeout after ${timeoutMs}ms`,
              timeout: timeoutMs,
            })
          )
        }
        
        yield* Effect.sleep("100 millis")
      }
    }.bind(this))

  /**
   * Send an HTTP request and return the response
   */
  readonly request = <TResult = unknown>(
    message: JSONRPCRequest
  ): Effect.Effect<JSONRPCResponse<TResult>, TransportError> =>
    Effect.gen(function* () {
      const currentState = yield* Ref.get(this.state)
      
      if (currentState !== "connected") {
        yield* Effect.fail(
          new TransportError({
            message: `Cannot send request, transport state is: ${currentState}`,
            transportType: "http",
          })
        )
      }

      try {
        const serialized = yield* this.serializer.serialize(message)
        const body = typeof serialized === "string" ? serialized : new TextDecoder().decode(serialized)
        
        const request = HttpClientRequest.post(this.getBaseUrl()).pipe(
          HttpClientRequest.setHeader("Content-Type", "application/json"),
          HttpClientRequest.setHeader("Accept", "application/json"),
          this.addCustomHeaders,
          HttpClientRequest.setBody(body)
        )

        const response = yield* this.httpClient.execute(request).pipe(
          Effect.timeout(`${this.config.timeout ?? 30000} millis`)
        )

        const responseBody = yield* HttpClientResponse.text(response)
        const responseMessage = yield* this.serializer.deserialize(responseBody)
        
        // Update stats
        yield* Ref.update(this.stats, (stats) => ({
          ...stats,
          messagesSent: stats.messagesSent + 1,
          messagesReceived: stats.messagesReceived + 1,
          bytesTransferred: stats.bytesTransferred + body.length + responseBody.length,
        }))

        yield* Effect.log(`HTTP transport completed request: ${message.method}`)
        
        return responseMessage as JSONRPCResponse<TResult>
      } catch (error) {
        yield* this.handleError(error as Error)
        yield* Effect.fail(
          new TransportError({
            message: `Failed to send HTTP request: ${String(error)}`,
            transportType: "http",
            cause: error,
          })
        )
      }
    }.bind(this))

  /**
   * Get the base URL for HTTP requests
   */
  private getBaseUrl(): string {
    const protocol = this.config.secure ? "https" : "http"
    const path = this.config.path ?? "/"
    return `${protocol}://${this.config.host}:${this.config.port}${path}`
  }

  /**
   * Add custom headers to HTTP requests
   */
  private readonly addCustomHeaders = (request: HttpClientRequest.HttpClientRequest) => {
    if (!this.config.headers) {
      return request
    }
    
    return Object.entries(this.config.headers).reduce(
      (req, [key, value]) => HttpClientRequest.setHeader(req, key, value),
      request
    )
  }

  /**
   * Perform health check to verify connection
   */
  private readonly performHealthCheck = (): Effect.Effect<void, Error> =>
    Effect.gen(function* () {
      const healthRequest = HttpClientRequest.get(this.getBaseUrl()).pipe(
        HttpClientRequest.setHeader("Accept", "application/json"),
        this.addCustomHeaders
      )

      yield* this.httpClient.execute(healthRequest).pipe(
        Effect.timeout(`${this.config.timeout ?? 10000} millis`),
        Effect.mapError((error) => new Error(`Health check failed: ${String(error)}`))
      )
    }.bind(this))

  /**
   * Handle transport errors
   */
  private readonly handleError = (error: Error): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      yield* Ref.update(this.stats, (stats) => ({
        ...stats,
        errors: stats.errors + 1,
        lastError: error,
      }))

      yield* Queue.offer(this.eventQueue, {
        type: "error",
        timestamp: new Date(),
        data: error,
      })

      yield* Effect.log(`HTTP transport error: ${error.message}`)
    }.bind(this))
}

/**
 * Create an HTTP transport factory
 */
export const createHttpTransport = (
  config: HttpTransportConfig
): Effect.Effect<Transport, never, Scope.Scope> =>
  Effect.gen(function* () {
    const transport = new HttpTransport(config)
    
    // Register cleanup on scope close
    yield* Effect.addFinalizer(() => transport.disconnect)
    
    return transport
  })

/**
 * Create an HTTP transport with automatic connection
 */
export const createConnectedHttpTransport = (
  config: HttpTransportConfig
): Effect.Effect<Transport, TransportError | ConnectionError, Scope.Scope> =>
  Effect.gen(function* () {
    const transport = yield* createHttpTransport(config)
    yield* transport.connect
    return transport
  })

/**
 * HTTP transport configuration helpers
 */
export const httpTransportConfig = (
  host: string,
  port: number,
  options?: {
    path?: string
    secure?: boolean
    timeout?: number
    headers?: Record<string, string>
  }
): HttpTransportConfig => ({
  type: "http",
  host,
  port,
  ...options,
})

/**
 * Type guard for HTTP transport config
 */
export const isHttpTransportConfig = (config: TransportConfig): config is HttpTransportConfig =>
  config.type === "http"

/**
 * Create HTTP transport config from URL
 */
export const httpTransportConfigFromUrl = (
  url: string,
  options?: {
    timeout?: number
    headers?: Record<string, string>
  }
): HttpTransportConfig => {
  const parsed = new URL(url)
  
  return {
    type: "http",
    host: parsed.hostname,
    port: parseInt(parsed.port) || (parsed.protocol === "https:" ? 443 : 80),
    path: parsed.pathname,
    secure: parsed.protocol === "https:",
    ...options,
  }
}