/**
 * FastMCP Schema Validation using @effect/schema
 * 
 * This module provides runtime validation schemas for all MCP protocol types,
 * replacing Python's Pydantic models with Effect's schema system.
 */

import { Schema } from "@effect/schema"
import type {
  JSONRPCVersion,
  RequestId,
  JSONRPCRequest,
  JSONRPCNotification,
  JSONRPCResponse,
  JSONRPCError,
  MCPProtocolVersion,
  ContentBlock,
  TextContent,
  ImageContent,
  ResourceContent,
  ResourceReference,
  Tool,
  Resource,
  ResourceTemplate,
  Prompt,
  PromptArgument,
  JSONSchema,
  SamplingMessage,
  ModelPreferences,
  ModelHint,
  Annotations,
} from "../types/protocol.js"

/**
 * Basic JSON-RPC schemas
 */
export const JSONRPCVersionSchema = Schema.Literal("2.0")

export const RequestIdSchema = Schema.Union(Schema.String, Schema.Number)

export const JSONRPCErrorSchema = Schema.Struct({
  code: Schema.Number,
  message: Schema.String,
  data: Schema.optional(Schema.Unknown),
})

/**
 * Content Block schemas
 */
export const TextContentSchema = Schema.Struct({
  type: Schema.Literal("text"),
  text: Schema.String,
})

export const ImageContentSchema = Schema.Struct({
  type: Schema.Literal("image"),
  data: Schema.String,
  mimeType: Schema.String,
})

export const ResourceReferenceSchema = Schema.Struct({
  uri: Schema.String,
  type: Schema.optional(Schema.String),
})

export const ResourceContentSchema = Schema.Struct({
  type: Schema.Literal("resource"),
  resource: ResourceReferenceSchema,
})

export const ContentBlockSchema: Schema.Schema<ContentBlock> = Schema.Union(
  TextContentSchema,
  ImageContentSchema,
  ResourceContentSchema
)

/**
 * Annotations schema
 */
export const AnnotationsSchema = Schema.Struct({
  audience: Schema.optional(Schema.Array(Schema.Union(Schema.Literal("human"), Schema.Literal("assistant")))),
  priority: Schema.optional(Schema.Number),
})

/**
 * JSON Schema definition (recursive)
 */
export const JSONSchemaSchema: Schema.Schema<JSONSchema> = Schema.suspend(() =>
  Schema.Struct({
    type: Schema.optional(Schema.Union(
      Schema.Literal("object"),
      Schema.Literal("array"),
      Schema.Literal("string"),
      Schema.Literal("number"),
      Schema.Literal("boolean"),
      Schema.Literal("null")
    )),
    properties: Schema.optional(Schema.Record(Schema.String, JSONSchemaSchema)),
    items: Schema.optional(JSONSchemaSchema),
    required: Schema.optional(Schema.Array(Schema.String)),
    description: Schema.optional(Schema.String),
    enum: Schema.optional(Schema.Array(Schema.Unknown)),
    const: Schema.optional(Schema.Unknown),
    additionalProperties: Schema.optional(Schema.Union(Schema.Boolean, JSONSchemaSchema)),
  })
)

/**
 * Tool schema
 */
export const ToolSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  inputSchema: JSONSchemaSchema,
})

/**
 * Resource schemas
 */
export const ResourceSchema = Schema.Struct({
  uri: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  mimeType: Schema.optional(Schema.String),
})

export const ResourceTemplateSchema = Schema.Struct({
  uriTemplate: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  mimeType: Schema.optional(Schema.String),
})

/**
 * Prompt schemas
 */
export const PromptArgumentSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  required: Schema.optional(Schema.Boolean),
})

export const PromptSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  arguments: Schema.optional(Schema.Array(PromptArgumentSchema)),
})

/**
 * Sampling schemas
 */
export const SamplingMessageSchema = Schema.Struct({
  role: Schema.Union(Schema.Literal("user"), Schema.Literal("assistant")),
  content: Schema.Union(ContentBlockSchema, Schema.Array(ContentBlockSchema)),
})

export const ModelHintSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
})

export const ModelPreferencesSchema = Schema.Struct({
  hints: Schema.optional(Schema.Array(ModelHintSchema)),
  costPriority: Schema.optional(Schema.Number),
  speedPriority: Schema.optional(Schema.Number),
  intelligencePriority: Schema.optional(Schema.Number),
})

/**
 * JSON-RPC message schemas
 */
export const JSONRPCRequestSchema = <P>(paramsSchema: Schema.Schema<P>) =>
  Schema.Struct({
    jsonrpc: JSONRPCVersionSchema,
    id: RequestIdSchema,
    method: Schema.String,
    params: Schema.optional(paramsSchema),
  })

export const JSONRPCNotificationSchema = <P>(paramsSchema: Schema.Schema<P>) =>
  Schema.Struct({
    jsonrpc: JSONRPCVersionSchema,
    method: Schema.String,
    params: Schema.optional(paramsSchema),
  })

export const JSONRPCResponseSuccessSchema = <R>(resultSchema: Schema.Schema<R>) =>
  Schema.Struct({
    jsonrpc: JSONRPCVersionSchema,
    id: RequestIdSchema,
    result: resultSchema,
  })

export const JSONRPCResponseErrorSchema = Schema.Struct({
  jsonrpc: JSONRPCVersionSchema,
  id: Schema.Union(RequestIdSchema, Schema.Null),
  error: JSONRPCErrorSchema,
})

export const JSONRPCResponseSchema = <R>(resultSchema: Schema.Schema<R>) =>
  Schema.Union(
    JSONRPCResponseSuccessSchema(resultSchema),
    JSONRPCResponseErrorSchema
  )

/**
 * Protocol version schema
 */
export const MCPProtocolVersionSchema = Schema.Literal("2024-11-05")

/**
 * Validation utilities
 */
export const validateContentBlock = Schema.decodeUnknown(ContentBlockSchema)
export const validateTool = Schema.decodeUnknown(ToolSchema)
export const validateResource = Schema.decodeUnknown(ResourceSchema)
export const validatePrompt = Schema.decodeUnknown(PromptSchema)
export const validateSamplingMessage = Schema.decodeUnknown(SamplingMessageSchema)

/**
 * JSON-RPC message validation helpers
 */
export const createRequestValidator = <P>(paramsSchema: Schema.Schema<P>) =>
  Schema.decodeUnknown(JSONRPCRequestSchema(paramsSchema))

export const createNotificationValidator = <P>(paramsSchema: Schema.Schema<P>) =>
  Schema.decodeUnknown(JSONRPCNotificationSchema(paramsSchema))

export const createResponseValidator = <R>(resultSchema: Schema.Schema<R>) =>
  Schema.decodeUnknown(JSONRPCResponseSchema(resultSchema))

/**
 * Schema composition utilities for complex validations
 */
export const createToolCallParamsSchema = (toolSchema: Schema.Schema<Tool>) =>
  Schema.Struct({
    name: Schema.String,
    arguments: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  }).pipe(
    Schema.filter((params) => {
      // Additional validation can be added here
      return params.name.length > 0
    }, {
      message: () => "Tool name cannot be empty"
    })
  )

export const createResourceReadParamsSchema = Schema.Struct({
  uri: Schema.String,
}).pipe(
  Schema.filter((params) => {
    // Basic URI validation
    try {
      new URL(params.uri)
      return true
    } catch {
      return params.uri.startsWith("/") || params.uri.includes("://")
    }
  }, {
    message: () => "Invalid URI format"
  })
)

/**
 * Array validation helpers
 */
export const ToolArraySchema = Schema.Array(ToolSchema)
export const ResourceArraySchema = Schema.Array(ResourceSchema)
export const PromptArraySchema = Schema.Array(PromptSchema)
export const ContentBlockArraySchema = Schema.Array(ContentBlockSchema)

/**
 * Pagination schema helpers
 */
export const createPaginatedSchema = <T>(itemSchema: Schema.Schema<T>) =>
  Schema.Struct({
    items: Schema.Array(itemSchema),
    nextCursor: Schema.optional(Schema.String),
  })

export const PaginatedToolsSchema = createPaginatedSchema(ToolSchema)
export const PaginatedResourcesSchema = createPaginatedSchema(ResourceSchema)
export const PaginatedPromptsSchema = createPaginatedSchema(PromptSchema)

/**
 * Error response schema helpers
 */
export const createErrorResponseSchema = (code: number, message: string) =>
  Schema.Struct({
    jsonrpc: JSONRPCVersionSchema,
    id: Schema.Union(RequestIdSchema, Schema.Null),
    error: Schema.Struct({
      code: Schema.Literal(code),
      message: Schema.Literal(message),
      data: Schema.optional(Schema.Unknown),
    }),
  })

/**
 * Configuration schema for server/client setup
 */
export const ServerConfigSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  description: Schema.optional(Schema.String),
  capabilities: Schema.Struct({
    tools: Schema.optional(Schema.Struct({
      listChanged: Schema.optional(Schema.Boolean),
    })),
    resources: Schema.optional(Schema.Struct({
      listChanged: Schema.optional(Schema.Boolean),
      subscribe: Schema.optional(Schema.Boolean),
    })),
    prompts: Schema.optional(Schema.Struct({
      listChanged: Schema.optional(Schema.Boolean),
    })),
    experimental: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  }),
})

export const ClientConfigSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  capabilities: Schema.Struct({
    sampling: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
    experimental: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  }),
})

/**
 * Transport configuration schemas
 */
export const TransportConfigSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("stdio"),
  }),
  Schema.Struct({
    type: Schema.Literal("http"),
    host: Schema.String,
    port: Schema.Number,
    path: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    type: Schema.Literal("websocket"),
    url: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("sse"),
    url: Schema.String,
  })
)

/**
 * Validation error helpers
 */
export const isSchemaError = (error: unknown): error is Schema.ParseError =>
  error instanceof Error && error.name === "ParseError"

export const formatSchemaError = (error: Schema.ParseError): string => {
  const issues = error.error.errors.map(issue => 
    `${issue.path.join('.')}: ${issue.message}`
  ).join(', ')
  return `Schema validation failed: ${issues}`
}