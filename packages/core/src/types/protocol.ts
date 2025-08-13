/**
 * Core MCP Protocol Types
 * 
 * TypeScript definitions for the Model Context Protocol (MCP) based on the official specification.
 * These types provide the foundation for type-safe MCP communication.
 */

/**
 * JSON-RPC 2.0 base types
 */
export type JSONRPCVersion = "2.0"

export type RequestId = string | number

/**
 * Base JSON-RPC message structure
 */
export interface JSONRPCMessage {
  readonly jsonrpc: JSONRPCVersion
}

/**
 * JSON-RPC Request
 */
export interface JSONRPCRequest<TParams = unknown> extends JSONRPCMessage {
  readonly id: RequestId
  readonly method: string
  readonly params?: TParams
}

/**
 * JSON-RPC Notification (request without id)
 */
export interface JSONRPCNotification<TParams = unknown> extends JSONRPCMessage {
  readonly method: string
  readonly params?: TParams
}

/**
 * JSON-RPC Response Success
 */
export interface JSONRPCResponseSuccess<TResult = unknown> extends JSONRPCMessage {
  readonly id: RequestId
  readonly result: TResult
}

/**
 * JSON-RPC Error object
 */
export interface JSONRPCError {
  readonly code: number
  readonly message: string
  readonly data?: unknown
}

/**
 * JSON-RPC Response Error
 */
export interface JSONRPCResponseError extends JSONRPCMessage {
  readonly id: RequestId | null
  readonly error: JSONRPCError
}

/**
 * Union type for all JSON-RPC responses
 */
export type JSONRPCResponse<TResult = unknown> = 
  | JSONRPCResponseSuccess<TResult>
  | JSONRPCResponseError

/**
 * Union type for all JSON-RPC messages
 */
export type JSONRPCMessageUnion<TParams = unknown, TResult = unknown> =
  | JSONRPCRequest<TParams>
  | JSONRPCNotification<TParams>
  | JSONRPCResponse<TResult>

/**
 * MCP Protocol Version
 */
export const MCP_PROTOCOL_VERSION = "2024-11-05" as const
export type MCPProtocolVersion = typeof MCP_PROTOCOL_VERSION

/**
 * Content Block Types
 */
export interface TextContent {
  readonly type: "text"
  readonly text: string
}

export interface ImageContent {
  readonly type: "image"
  readonly data: string
  readonly mimeType: string
}

export interface ResourceContent {
  readonly type: "resource"
  readonly resource: ResourceReference
}

export type ContentBlock = TextContent | ImageContent | ResourceContent

/**
 * Resource Reference
 */
export interface ResourceReference {
  readonly uri: string
  readonly type?: string
}

/**
 * Annotations for enhanced metadata
 */
export interface Annotations {
  readonly audience?: readonly ("human" | "assistant")[]
  readonly priority?: number
}

/**
 * Tool Definition
 */
export interface Tool {
  readonly name: string
  readonly description?: string
  readonly inputSchema: JSONSchema
}

/**
 * Resource Definition  
 */
export interface Resource {
  readonly uri: string
  readonly name: string
  readonly description?: string
  readonly mimeType?: string
}

/**
 * Resource Template for dynamic resources
 */
export interface ResourceTemplate {
  readonly uriTemplate: string
  readonly name: string
  readonly description?: string
  readonly mimeType?: string
}

/**
 * Prompt Definition
 */
export interface Prompt {
  readonly name: string
  readonly description?: string
  readonly arguments?: readonly PromptArgument[]
}

/**
 * Prompt Argument
 */
export interface PromptArgument {
  readonly name: string
  readonly description?: string
  readonly required?: boolean
}

/**
 * JSON Schema (simplified for MCP usage)
 */
export interface JSONSchema {
  readonly type?: "object" | "array" | "string" | "number" | "boolean" | "null"
  readonly properties?: Record<string, JSONSchema>
  readonly items?: JSONSchema
  readonly required?: readonly string[]
  readonly description?: string
  readonly enum?: readonly unknown[]
  readonly const?: unknown
  readonly additionalProperties?: boolean | JSONSchema
}

/**
 * Sampling Message for LLM interaction
 */
export interface SamplingMessage {
  readonly role: "user" | "assistant"
  readonly content: ContentBlock | readonly ContentBlock[]
}

/**
 * Model Preferences
 */
export interface ModelPreferences {
  readonly hints?: readonly ModelHint[]
  readonly costPriority?: number
  readonly speedPriority?: number
  readonly intelligencePriority?: number
}

/**
 * Model Hint
 */
export interface ModelHint {
  readonly name?: string
}

/**
 * Pagination Cursor
 */
export type Cursor = string

/**
 * Common error codes used in MCP
 */
export const MCP_ERROR_CODES = {
  // Standard JSON-RPC errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  
  // MCP-specific errors
  TOOL_ERROR: -32000,
  RESOURCE_ERROR: -32001,
  PROMPT_ERROR: -32002,
  CANCELLED: -32800,
} as const

export type MCPErrorCode = typeof MCP_ERROR_CODES[keyof typeof MCP_ERROR_CODES]