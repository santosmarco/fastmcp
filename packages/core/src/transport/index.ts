/**
 * FastMCP Transport System
 * 
 * Simple transport abstractions matching the original Python implementation.
 * Provides abstract base class for different MCP client transport mechanisms.
 */

import { Effect } from "effect"

/**
 * Transport types matching the original Python implementation
 */
export type TransportType = "stdio" | "http" | "sse" | "streamable-http" | "websocket"

/**
 * Basic transport configuration
 */
export interface TransportConfig {
  readonly type: TransportType
}

export interface StdioTransportConfig extends TransportConfig {
  readonly type: "stdio"
}

export interface HttpTransportConfig extends TransportConfig {
  readonly type: "http"
  readonly host: string
  readonly port: number
  readonly path?: string
  readonly secure?: boolean
}

export interface WebSocketTransportConfig extends TransportConfig {
  readonly type: "websocket"
  readonly url: string
}

export interface SSETransportConfig extends TransportConfig {
  readonly type: "sse"
  readonly url: string
}

/**
 * Union of all transport configurations
 */
export type AnyTransportConfig = 
  | StdioTransportConfig 
  | HttpTransportConfig 
  | WebSocketTransportConfig 
  | SSETransportConfig

/**
 * Session interface representing an MCP client session
 * (This would be imported from the MCP library in a real implementation)
 */
export interface ClientSession {
  // Placeholder for MCP ClientSession interface
  readonly initialized: boolean
}

/**
 * Abstract base class for different MCP client transport mechanisms.
 * 
 * A Transport is responsible for establishing and managing connections
 * to an MCP server, and providing a ClientSession within an async context.
 * 
 * Matches the original Python ClientTransport interface.
 */
export abstract class ClientTransport {
  /**
   * Establishes a connection and yields an active ClientSession.
   * 
   * The ClientSession is *not* expected to be initialized in this context manager.
   * 
   * The session is guaranteed to be valid only within the scope of the
   * async context manager. Connection setup and teardown are handled
   * within this context.
   */
  abstract connectSession(): Effect.Effect<ClientSession, Error>
}

/**
 * Simple stdio transport implementation
 */
export class StdioTransport extends ClientTransport {
  constructor(private readonly config: StdioTransportConfig) {
    super()
  }

  connectSession(): Effect.Effect<ClientSession, Error> {
    return Effect.succeed({
      initialized: false
    })
  }
}

/**
 * Simple HTTP transport implementation
 */
export class HttpTransport extends ClientTransport {
  constructor(private readonly config: HttpTransportConfig) {
    super()
  }

  connectSession(): Effect.Effect<ClientSession, Error> {
    return Effect.succeed({
      initialized: false
    })
  }
}

/**
 * Create a transport from configuration
 */
export function createTransport(config: AnyTransportConfig): ClientTransport {
  switch (config.type) {
    case "stdio":
      return new StdioTransport(config)
    case "http":
      return new HttpTransport(config)
    default:
      throw new Error(`Unsupported transport type: ${(config as any).type}`)
  }
}