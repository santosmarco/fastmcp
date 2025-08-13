/**
 * MCP Method-Specific Types
 * 
 * Type definitions for all MCP protocol methods including their request parameters
 * and response types. These provide type safety for MCP method calls.
 */

import type {
  JSONRPCRequest,
  JSONRPCResponse,
  ContentBlock,
  Tool,
  Resource,
  ResourceTemplate,
  Prompt,
  SamplingMessage,
  ModelPreferences,
  Cursor,
  MCPProtocolVersion,
  JSONSchema,
  Annotations,
} from "./protocol.js"

/**
 * Initialize Method
 */
export interface InitializeRequestParams {
  readonly protocolVersion: MCPProtocolVersion
  readonly capabilities: ClientCapabilities
  readonly clientInfo: Implementation
}

export interface InitializeResult {
  readonly protocolVersion: MCPProtocolVersion
  readonly capabilities: ServerCapabilities
  readonly serverInfo: Implementation
  readonly instructions?: string
}

export interface ClientCapabilities {
  readonly experimental?: Record<string, Record<string, unknown>>
  readonly sampling?: Record<string, unknown>
}

export interface ServerCapabilities {
  readonly experimental?: Record<string, Record<string, unknown>>
  readonly logging?: Record<string, unknown>
  readonly prompts?: ListCapability
  readonly resources?: ResourceCapabilities
  readonly tools?: ListCapability
}

export interface ListCapability {
  readonly listChanged?: boolean
}

export interface ResourceCapabilities extends ListCapability {
  readonly subscribe?: boolean
}

export interface Implementation {
  readonly name: string
  readonly version: string
}

/**
 * Ping Method (for connection health)
 */
export interface PingResult {
  // Empty response - just confirms connection
}

/**
 * List Tools Method
 */
export interface ListToolsRequestParams {
  readonly cursor?: Cursor
}

export interface ListToolsResult {
  readonly tools: readonly Tool[]
  readonly nextCursor?: Cursor
}

/**
 * Call Tool Method
 */
export interface CallToolRequestParams {
  readonly name: string
  readonly arguments?: Record<string, unknown>
}

export interface CallToolResult {
  readonly content: readonly ContentBlock[]
  readonly isError?: boolean
  readonly _meta?: Record<string, unknown>
}

/**
 * List Resources Method
 */
export interface ListResourcesRequestParams {
  readonly cursor?: Cursor
}

export interface ListResourcesResult {
  readonly resources: readonly Resource[]
  readonly nextCursor?: Cursor
}

/**
 * List Resource Templates Method
 */
export interface ListResourceTemplatesRequestParams {
  readonly cursor?: Cursor
}

export interface ListResourceTemplatesResult {
  readonly resourceTemplates: readonly ResourceTemplate[]
  readonly nextCursor?: Cursor
}

/**
 * Read Resource Method
 */
export interface ReadResourceRequestParams {
  readonly uri: string
}

export interface ReadResourceResult {
  readonly contents: readonly ResourceContents[]
}

export interface ResourceContents {
  readonly uri: string
  readonly mimeType?: string
  readonly text?: string
  readonly blob?: string
}

/**
 * Subscribe/Unsubscribe Resource Methods
 */
export interface SubscribeRequestParams {
  readonly uri: string
}

export interface UnsubscribeRequestParams {
  readonly uri: string
}

export interface SubscribeResult {
  // Empty response
}

export interface UnsubscribeResult {
  // Empty response
}

/**
 * List Prompts Method
 */
export interface ListPromptsRequestParams {
  readonly cursor?: Cursor
}

export interface ListPromptsResult {
  readonly prompts: readonly Prompt[]
  readonly nextCursor?: Cursor
}

/**
 * Get Prompt Method
 */
export interface GetPromptRequestParams {
  readonly name: string
  readonly arguments?: Record<string, unknown>
}

export interface GetPromptResult {
  readonly description?: string
  readonly messages: readonly PromptMessage[]
  readonly _meta?: Record<string, unknown>
}

export interface PromptMessage {
  readonly role: "user" | "assistant"
  readonly content: ContentBlock | readonly ContentBlock[]
}

/**
 * Complete Method (for auto-completion)
 */
export interface CompleteRequestParams {
  readonly ref: CompletionRef
  readonly argument: CompletionArgument
}

export interface CompleteResult {
  readonly completion: Completion
}

export interface CompletionRef {
  readonly type: "ref/resource" | "ref/prompt"
  readonly uri?: string
  readonly name?: string
}

export interface CompletionArgument {
  readonly name: string
  readonly value: string
}

export interface Completion {
  readonly values: readonly string[]
  readonly total?: number
  readonly hasMore?: boolean
}

/**
 * Sampling Methods (for LLM interaction)
 */
export interface CreateMessageRequestParams {
  readonly messages: readonly SamplingMessage[]
  readonly modelPreferences?: ModelPreferences
  readonly systemPrompt?: string
  readonly includeContext?: "none" | "thisServer" | "allServers"
  readonly temperature?: number
  readonly maxTokens: number
  readonly metadata?: Record<string, unknown>
}

export interface CreateMessageResult {
  readonly role: "assistant"
  readonly content: ContentBlock | readonly ContentBlock[]
  readonly model: string
  readonly stopReason?: "endTurn" | "stopSequence" | "maxTokens"
  readonly _meta?: Record<string, unknown>
}

/**
 * Notification Methods (server -> client)
 */
export interface LoggingMessageNotificationParams {
  readonly level: "debug" | "info" | "notice" | "warning" | "error" | "critical" | "alert" | "emergency"
  readonly data: unknown
  readonly logger?: string
}

export interface ResourceUpdatedNotificationParams {
  readonly uri: string
}

export interface ResourceListChangedNotificationParams {
  // Empty - just signals that the list changed
}

export interface ToolListChangedNotificationParams {
  // Empty - just signals that the list changed
}

export interface PromptListChangedNotificationParams {
  // Empty - just signals that the list changed
}

export interface ProgressNotificationParams {
  readonly progressToken: string | number
  readonly progress: number
  readonly total?: number
}

/**
 * Method name constants
 */
export const MCP_METHODS = {
  // Lifecycle
  INITIALIZE: "initialize",
  PING: "ping",
  
  // Tools
  LIST_TOOLS: "tools/list",
  CALL_TOOL: "tools/call",
  
  // Resources
  LIST_RESOURCES: "resources/list",
  LIST_RESOURCE_TEMPLATES: "resources/templates/list",
  READ_RESOURCE: "resources/read",
  SUBSCRIBE: "resources/subscribe",
  UNSUBSCRIBE: "resources/unsubscribe",
  
  // Prompts
  LIST_PROMPTS: "prompts/list",
  GET_PROMPT: "prompts/get",
  
  // Completion
  COMPLETE: "completion/complete",
  
  // Sampling
  CREATE_MESSAGE: "sampling/createMessage",
  
  // Notifications
  LOGGING_MESSAGE: "notifications/message",
  RESOURCE_UPDATED: "notifications/resources/updated",
  RESOURCE_LIST_CHANGED: "notifications/resources/list_changed",
  TOOL_LIST_CHANGED: "notifications/tools/list_changed",
  PROMPT_LIST_CHANGED: "notifications/prompts/list_changed",
  PROGRESS: "notifications/progress",
} as const

export type MCPMethod = typeof MCP_METHODS[keyof typeof MCP_METHODS]

/**
 * Type-safe method request mapping
 */
export interface MCPMethodRequestMap {
  [MCP_METHODS.INITIALIZE]: JSONRPCRequest<InitializeRequestParams>
  [MCP_METHODS.PING]: JSONRPCRequest<undefined>
  [MCP_METHODS.LIST_TOOLS]: JSONRPCRequest<ListToolsRequestParams>
  [MCP_METHODS.CALL_TOOL]: JSONRPCRequest<CallToolRequestParams>
  [MCP_METHODS.LIST_RESOURCES]: JSONRPCRequest<ListResourcesRequestParams>
  [MCP_METHODS.LIST_RESOURCE_TEMPLATES]: JSONRPCRequest<ListResourceTemplatesRequestParams>
  [MCP_METHODS.READ_RESOURCE]: JSONRPCRequest<ReadResourceRequestParams>
  [MCP_METHODS.SUBSCRIBE]: JSONRPCRequest<SubscribeRequestParams>
  [MCP_METHODS.UNSUBSCRIBE]: JSONRPCRequest<UnsubscribeRequestParams>
  [MCP_METHODS.LIST_PROMPTS]: JSONRPCRequest<ListPromptsRequestParams>
  [MCP_METHODS.GET_PROMPT]: JSONRPCRequest<GetPromptRequestParams>
  [MCP_METHODS.COMPLETE]: JSONRPCRequest<CompleteRequestParams>
  [MCP_METHODS.CREATE_MESSAGE]: JSONRPCRequest<CreateMessageRequestParams>
}

/**
 * Type-safe method response mapping
 */
export interface MCPMethodResponseMap {
  [MCP_METHODS.INITIALIZE]: JSONRPCResponse<InitializeResult>
  [MCP_METHODS.PING]: JSONRPCResponse<PingResult>
  [MCP_METHODS.LIST_TOOLS]: JSONRPCResponse<ListToolsResult>
  [MCP_METHODS.CALL_TOOL]: JSONRPCResponse<CallToolResult>
  [MCP_METHODS.LIST_RESOURCES]: JSONRPCResponse<ListResourcesResult>
  [MCP_METHODS.LIST_RESOURCE_TEMPLATES]: JSONRPCResponse<ListResourceTemplatesResult>
  [MCP_METHODS.READ_RESOURCE]: JSONRPCResponse<ReadResourceResult>
  [MCP_METHODS.SUBSCRIBE]: JSONRPCResponse<SubscribeResult>
  [MCP_METHODS.UNSUBSCRIBE]: JSONRPCResponse<UnsubscribeResult>
  [MCP_METHODS.LIST_PROMPTS]: JSONRPCResponse<ListPromptsResult>
  [MCP_METHODS.GET_PROMPT]: JSONRPCResponse<GetPromptResult>
  [MCP_METHODS.COMPLETE]: JSONRPCResponse<CompleteResult>
  [MCP_METHODS.CREATE_MESSAGE]: JSONRPCResponse<CreateMessageResult>
}