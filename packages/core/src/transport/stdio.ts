/**
 * Stdio Transport Implementation for FastMCP
 * 
 * This transport implementation handles communication over stdin/stdout,
 * which is commonly used for MCP servers that are spawned as child processes.
 */

import { Effect, Stream, Scope, Queue, Ref, pipe } from "effect"
import { createReadStream, createWriteStream } from "node:fs"
import { stdin, stdout } from "node:process"
import { createInterface, Interface } from "node:readline"
import type {
  Transport,
  TransportConfig,
  TransportState,
  TransportStats,
  TransportEvent,
  MessageSerializer,
  JsonMessageSerializer,
  StdioTransportConfig,
} from "./index.js"
import type { JSONRPCMessageUnion } from "../types/protocol.js"
import {
  TransportError,
  ConnectionError,
  DisconnectedError,
  TimeoutError,
} from "../errors/index.js"

/**
 * Stdio Transport Implementation
 */
export class StdioTransport implements Transport {
  private readonly config: StdioTransportConfig
  private readonly serializer: MessageSerializer
  private readonly state: Ref.Ref<TransportState>
  private readonly stats: Ref.Ref<TransportStats>
  private readonly eventQueue: Queue.Queue<TransportEvent>
  private readonly messageQueue: Queue.Queue<JSONRPCMessageUnion>
  private readline?: Interface

  constructor(
    config: StdioTransportConfig,
    serializer: MessageSerializer = JsonMessageSerializer
  ) {
    this.config = config
    this.serializer = serializer
    this.state = Ref.unsafeMake<TransportState>("disconnected")
    this.eventQueue = Queue.unbounded<TransportEvent>()
    this.messageQueue = Queue.unbounded<JSONRPCMessageUnion>()
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
        // Create readline interface for line-based communication
        this.readline = createInterface({
          input: stdin,
          output: stdout,
          terminal: false,
        })

        // Set up message receiving
        this.readline.on("line", (line: string) => {
          Effect.runSync(this.handleIncomingMessage(line))
        })

        this.readline.on("close", () => {
          Effect.runSync(this.handleDisconnection("stdin closed"))
        })

        this.readline.on("error", (error: Error) => {
          Effect.runSync(this.handleError(error))
        })

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

        yield* Effect.log("Stdio transport connected")
      } catch (error) {
        yield* Ref.set(this.state, "error")
        yield* this.handleError(error as Error)
        yield* Effect.fail(
          new ConnectionError({
            message: `Failed to connect stdio transport: ${String(error)}`,
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
        if (this.readline) {
          this.readline.close()
          this.readline = undefined
        }

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

        yield* Effect.log("Stdio transport disconnected")
      } catch (error) {
        yield* Effect.log(`Error during stdio transport disconnect: ${String(error)}`)
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
            transportType: "stdio",
          })
        )
      }

      try {
        const serialized = yield* this.serializer.serialize(message)
        const data = typeof serialized === "string" ? serialized : new TextDecoder().decode(serialized)
        
        // Write to stdout with newline delimiter
        stdout.write(data + "\n")
        
        // Update stats
        yield* Ref.update(this.stats, (stats) => ({
          ...stats,
          messagesSent: stats.messagesSent + 1,
          bytesTransferred: stats.bytesTransferred + data.length,
        }))

        yield* Effect.log(`Stdio transport sent message: ${message.method ?? 'response'}`)
      } catch (error) {
        yield* this.handleError(error as Error)
        yield* Effect.fail(
          new TransportError({
            message: `Failed to send message via stdio: ${String(error)}`,
            transportType: "stdio",
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
        message: `Error receiving message from stdio: ${String(error)}`,
        transportType: "stdio",
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
   * Handle incoming message from stdin
   */
  private readonly handleIncomingMessage = (line: string): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      try {
        if (line.trim() === "") {
          return // Skip empty lines
        }

        const message = yield* this.serializer.deserialize(line)
        yield* Queue.offer(this.messageQueue, message)
        
        // Update stats
        yield* Ref.update(this.stats, (stats) => ({
          ...stats,
          messagesReceived: stats.messagesReceived + 1,
          bytesTransferred: stats.bytesTransferred + line.length,
        }))

        // Emit message event
        yield* Queue.offer(this.eventQueue, {
          type: "message",
          timestamp: new Date(),
          data: message,
        })

        yield* Effect.log(`Stdio transport received message: ${message.method ?? 'response'}`)
      } catch (error) {
        yield* this.handleError(error as Error)
      }
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

      yield* Effect.log(`Stdio transport error: ${error.message}`)
    }.bind(this))

  /**
   * Handle disconnection
   */
  private readonly handleDisconnection = (reason: string): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      yield* Ref.set(this.state, "disconnected")
      yield* Ref.update(this.stats, (stats) => ({
        ...stats,
        state: "disconnected",
      }))

      yield* Queue.offer(this.eventQueue, {
        type: "disconnected",
        timestamp: new Date(),
        data: { reason },
      })

      yield* Effect.log(`Stdio transport disconnected: ${reason}`)
    }.bind(this))
}

/**
 * Create a stdio transport factory
 */
export const createStdioTransport = (
  config: StdioTransportConfig
): Effect.Effect<Transport, never, Scope.Scope> =>
  Effect.gen(function* () {
    const transport = new StdioTransport(config)
    
    // Register cleanup on scope close
    yield* Effect.addFinalizer(() => transport.disconnect)
    
    return transport
  })

/**
 * Create a stdio transport with automatic connection
 */
export const createConnectedStdioTransport = (
  config: StdioTransportConfig
): Effect.Effect<Transport, TransportError | ConnectionError, Scope.Scope> =>
  Effect.gen(function* () {
    const transport = yield* createStdioTransport(config)
    yield* transport.connect
    return transport
  })

/**
 * Stdio transport configuration helpers
 */
export const stdioTransportConfig = (): StdioTransportConfig => ({
  type: "stdio",
})

/**
 * Type guard for stdio transport config
 */
export const isStdioTransportConfig = (config: TransportConfig): config is StdioTransportConfig =>
  config.type === "stdio"