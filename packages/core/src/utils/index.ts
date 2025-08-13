/**
 * FastMCP Type Utilities and Helper Functions
 * 
 * This module provides utility types, helper functions, and common patterns
 * for working with FastMCP types in a type-safe manner.
 */

import { Effect, pipe } from "effect"
import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCResponseSuccess,
  JSONRPCResponseError,
  RequestId,
  MCPMethod,
  ContentBlock,
  TextContent,
  ImageContent,
  ResourceContent,
} from "../types/protocol.js"
import type { MCPMethodRequestMap, MCPMethodResponseMap } from "../types/methods.js"

/**
 * Type utility helpers
 */

/**
 * Extract the parameters type from a method request
 */
export type ExtractParams<T extends MCPMethod> = T extends keyof MCPMethodRequestMap
  ? MCPMethodRequestMap[T] extends JSONRPCRequest<infer P>
    ? P
    : never
  : never

/**
 * Extract the result type from a method response
 */
export type ExtractResult<T extends MCPMethod> = T extends keyof MCPMethodResponseMap
  ? MCPMethodResponseMap[T] extends JSONRPCResponse<infer R>
    ? R
    : never
  : never

/**
 * Make all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Make specific properties K of T required
 */
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>

/**
 * Create a branded type for better type safety
 */
export type Brand<T, B> = T & { readonly __brand: B }

/**
 * URI brand for type-safe URI handling
 */
export type URI = Brand<string, "URI">

/**
 * Tool name brand for type-safe tool references
 */
export type ToolName = Brand<string, "ToolName">

/**
 * Prompt name brand for type-safe prompt references
 */
export type PromptName = Brand<string, "PromptName">

/**
 * JSON-RPC helper functions
 */

/**
 * Create a JSON-RPC request with proper typing
 */
export const createRequest = <T extends MCPMethod>(
  method: T,
  id: RequestId,
  params?: ExtractParams<T>
): JSONRPCRequest<ExtractParams<T>> => ({
  jsonrpc: "2.0",
  method,
  id,
  ...(params !== undefined ? { params } : {}),
})

/**
 * Create a JSON-RPC success response
 */
export const createSuccessResponse = <T>(
  id: RequestId,
  result: T
): JSONRPCResponseSuccess<T> => ({
  jsonrpc: "2.0",
  id,
  result,
})

/**
 * Create a JSON-RPC error response
 */
export const createErrorResponse = (
  id: RequestId | null,
  code: number,
  message: string,
  data?: unknown
): JSONRPCResponseError => ({
  jsonrpc: "2.0",
  id,
  error: {
    code,
    message,
    ...(data !== undefined ? { data } : {}),
  },
})

/**
 * Type guards for JSON-RPC messages
 */
export const isRequest = (message: unknown): message is JSONRPCRequest =>
  typeof message === "object" &&
  message !== null &&
  "jsonrpc" in message &&
  "method" in message &&
  "id" in message

export const isNotification = (message: unknown): message is JSONRPCRequest =>
  typeof message === "object" &&
  message !== null &&
  "jsonrpc" in message &&
  "method" in message &&
  !("id" in message)

export const isSuccessResponse = (message: unknown): message is JSONRPCResponseSuccess =>
  typeof message === "object" &&
  message !== null &&
  "jsonrpc" in message &&
  "id" in message &&
  "result" in message

export const isErrorResponse = (message: unknown): message is JSONRPCResponseError =>
  typeof message === "object" &&
  message !== null &&
  "jsonrpc" in message &&
  "id" in message &&
  "error" in message

/**
 * Content block utilities
 */

/**
 * Create text content block
 */
export const createTextContent = (text: string): TextContent => ({
  type: "text",
  text,
})

/**
 * Create image content block
 */
export const createImageContent = (data: string, mimeType: string): ImageContent => ({
  type: "image",
  data,
  mimeType,
})

/**
 * Create resource content block
 */
export const createResourceContent = (uri: URI, type?: string): ResourceContent => ({
  type: "resource",
  resource: {
    uri,
    ...(type ? { type } : {}),
  },
})

/**
 * Type guards for content blocks
 */
export const isTextContent = (content: ContentBlock): content is TextContent =>
  content.type === "text"

export const isImageContent = (content: ContentBlock): content is ImageContent =>
  content.type === "image"

export const isResourceContent = (content: ContentBlock): content is ResourceContent =>
  content.type === "resource"

/**
 * Extract text from content blocks
 */
export const extractText = (content: ContentBlock | readonly ContentBlock[]): string => {
  const blocks = Array.isArray(content) ? content : [content]
  return blocks
    .filter(isTextContent)
    .map(block => block.text)
    .join("\n")
}

/**
 * URI utilities
 */

/**
 * Create a branded URI from a string
 */
export const createURI = (uri: string): URI => uri as URI

/**
 * Validate URI format
 */
export const isValidURI = (uri: string): boolean => {
  try {
    new URL(uri)
    return true
  } catch {
    return uri.startsWith("/") || uri.includes("://")
  }
}

/**
 * Parse URI components
 */
export const parseURI = (uri: URI) => {
  try {
    const url = new URL(uri)
    return {
      scheme: url.protocol.slice(0, -1),
      host: url.hostname,
      port: url.port ? parseInt(url.port) : undefined,
      path: url.pathname,
      query: url.search,
      fragment: url.hash,
    }
  } catch {
    // Handle relative URIs
    return {
      scheme: undefined,
      host: undefined,
      port: undefined,
      path: uri,
      query: undefined,
      fragment: undefined,
    }
  }
}

/**
 * Tool and Prompt name utilities
 */
export const createToolName = (name: string): ToolName => name as ToolName
export const createPromptName = (name: string): PromptName => name as PromptName

/**
 * JSON utilities with Effect error handling
 */

/**
 * Safe JSON parsing with Effect
 */
export const parseJSON = (text: string) =>
  Effect.try({
    try: () => JSON.parse(text) as unknown,
    catch: (error) => new Error(`JSON parse error: ${String(error)}`),
  })

/**
 * Safe JSON stringification with Effect
 */
export const stringifyJSON = (value: unknown) =>
  Effect.try({
    try: () => JSON.stringify(value),
    catch: (error) => new Error(`JSON stringify error: ${String(error)}`),
  })

/**
 * Deep clone using JSON serialization
 */
export const deepClone = <T>(value: T) =>
  pipe(
    stringifyJSON(value),
    Effect.flatMap(parseJSON),
    Effect.map(result => result as T)
  )

/**
 * Object utilities
 */

/**
 * Remove undefined properties from an object
 */
export const removeUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
  const result: Partial<T> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key as keyof T] = value as T[keyof T]
    }
  }
  return result
}

/**
 * Merge objects with proper typing
 */
export const merge = <T, U>(obj1: T, obj2: U): T & U => ({
  ...obj1,
  ...obj2,
})

/**
 * Pick specific keys from an object
 */
export const pick = <T, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> => {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key]
    }
  }
  return result
}

/**
 * Omit specific keys from an object
 */
export const omit = <T, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K> => {
  const result = { ...obj }
  for (const key of keys) {
    delete result[key]
  }
  return result
}

/**
 * Array utilities
 */

/**
 * Check if array is non-empty and return typed result
 */
export const isNonEmpty = <T>(arr: readonly T[]): arr is readonly [T, ...T[]] =>
  arr.length > 0

/**
 * Safe array access with Effect
 */
export const safeGet = <T>(arr: readonly T[], index: number) =>
  Effect.succeed(arr[index]).pipe(
    Effect.filterOrFail(
      (item): item is T => item !== undefined,
      () => new Error(`Index ${index} out of bounds for array of length ${arr.length}`)
    )
  )

/**
 * Chunk array into smaller arrays
 */
export const chunk = <T>(arr: readonly T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

/**
 * Unique elements in array
 */
export const unique = <T>(arr: readonly T[]): T[] => Array.from(new Set(arr))

/**
 * Promise utilities for Effect integration
 */

/**
 * Convert Promise to Effect
 */
export const fromPromise = <T>(promise: Promise<T>) =>
  Effect.tryPromise({
    try: () => promise,
    catch: (error) => new Error(`Promise rejected: ${String(error)}`),
  })

/**
 * Convert Effect to Promise
 */
export const toPromise = <T, E>(effect: Effect.Effect<T, E>) =>
  Effect.runPromise(effect)

/**
 * Validation utilities
 */

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate URL format
 */
export const isValidURL = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Validate non-empty string
 */
export const isNonEmptyString = (value: string): boolean => {
  return typeof value === "string" && value.trim().length > 0
}

/**
 * Time utilities
 */

/**
 * Get current timestamp in milliseconds
 */
export const now = (): number => Date.now()

/**
 * Get current ISO string
 */
export const nowISO = (): string => new Date().toISOString()

/**
 * Sleep for specified milliseconds using Effect
 */
export const sleep = (ms: number) => Effect.sleep(`${ms} millis`)

/**
 * Timeout an Effect after specified milliseconds
 */
export const timeout = <T, E>(effect: Effect.Effect<T, E>, ms: number) =>
  Effect.race(effect, Effect.fail(new Error("Timeout")))

/**
 * Debug utilities
 */

/**
 * Log with Effect
 */
export const log = (message: string) => Effect.log(message)

/**
 * Log with context
 */
export const logWithContext = (message: string, context: Record<string, unknown>) =>
  Effect.log(`${message} | Context: ${JSON.stringify(context)}`)

/**
 * Measure execution time of an Effect
 */
export const measureTime = <T, E>(effect: Effect.Effect<T, E>) =>
  Effect.gen(function* () {
    const start = yield* Effect.sync(() => Date.now())
    const result = yield* effect
    const end = yield* Effect.sync(() => Date.now())
    const duration = end - start
    yield* Effect.log(`Execution time: ${duration}ms`)
    return result
  })