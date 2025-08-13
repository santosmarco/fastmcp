/**
 * FastMCP Error System using Effect Tagged Errors
 * 
 * This module provides a comprehensive error hierarchy using Effect's tagged error system.
 * All errors are type-safe and composable, replacing Python's exception-based error handling.
 */

import { Data } from "effect"
import type { MCPErrorCode } from "../types/protocol.js"

/**
 * Base FastMCP Error
 * All FastMCP errors extend this base class
 */
export abstract class FastMCPError extends Data.TaggedError("FastMCPError")<{
  readonly message: string
  readonly cause?: unknown
  readonly code?: MCPErrorCode
  readonly data?: unknown
}> {
  abstract readonly _tag: string
}

/**
 * Protocol-level errors
 */
export class ProtocolError extends Data.TaggedError("ProtocolError")<{
  readonly message: string
  readonly method?: string
  readonly cause?: unknown
  readonly code?: MCPErrorCode
}> {}

export class InvalidRequestError extends Data.TaggedError("InvalidRequestError")<{
  readonly message: string
  readonly request?: unknown
  readonly cause?: unknown
}> {}

export class MethodNotFoundError extends Data.TaggedError("MethodNotFoundError")<{
  readonly method: string
  readonly message?: string
}> {}

export class InvalidParamsError extends Data.TaggedError("InvalidParamsError")<{
  readonly message: string
  readonly method?: string
  readonly params?: unknown
  readonly cause?: unknown
}> {}

export class ParseError extends Data.TaggedError("ParseError")<{
  readonly message: string
  readonly input?: string
  readonly cause?: unknown
}> {}

/**
 * Transport-level errors
 */
export class TransportError extends Data.TaggedError("TransportError")<{
  readonly message: string
  readonly transportType?: string
  readonly cause?: unknown
}> {}

export class ConnectionError extends Data.TaggedError("ConnectionError")<{
  readonly message: string
  readonly endpoint?: string
  readonly cause?: unknown
}> {}

export class TimeoutError extends Data.TaggedError("TimeoutError")<{
  readonly message: string
  readonly timeout: number
  readonly operation?: string
}> {}

export class DisconnectedError extends Data.TaggedError("DisconnectedError")<{
  readonly message: string
  readonly reason?: string
}> {}

/**
 * Tool-related errors
 */
export class ToolError extends Data.TaggedError("ToolError")<{
  readonly message: string
  readonly toolName: string
  readonly cause?: unknown
  readonly isError?: boolean
}> {}

export class ToolNotFoundError extends Data.TaggedError("ToolNotFoundError")<{
  readonly toolName: string
  readonly message?: string
}> {}

export class ToolValidationError extends Data.TaggedError("ToolValidationError")<{
  readonly message: string
  readonly toolName: string
  readonly invalidParams?: unknown
  readonly cause?: unknown
}> {}

export class ToolExecutionError extends Data.TaggedError("ToolExecutionError")<{
  readonly message: string
  readonly toolName: string
  readonly cause?: unknown
}> {}

/**
 * Resource-related errors
 */
export class ResourceError extends Data.TaggedError("ResourceError")<{
  readonly message: string
  readonly uri: string
  readonly cause?: unknown
}> {}

export class ResourceNotFoundError extends Data.TaggedError("ResourceNotFoundError")<{
  readonly uri: string
  readonly message?: string
}> {}

export class ResourceAccessError extends Data.TaggedError("ResourceAccessError")<{
  readonly message: string
  readonly uri: string
  readonly cause?: unknown
}> {}

export class ResourceValidationError extends Data.TaggedError("ResourceValidationError")<{
  readonly message: string
  readonly uri: string
  readonly cause?: unknown
}> {}

/**
 * Prompt-related errors
 */
export class PromptError extends Data.TaggedError("PromptError")<{
  readonly message: string
  readonly promptName: string
  readonly cause?: unknown
}> {}

export class PromptNotFoundError extends Data.TaggedError("PromptNotFoundError")<{
  readonly promptName: string
  readonly message?: string
}> {}

export class PromptValidationError extends Data.TaggedError("PromptValidationError")<{
  readonly message: string
  readonly promptName: string
  readonly invalidArgs?: unknown
  readonly cause?: unknown
}> {}

/**
 * Authentication and Authorization errors
 */
export class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class AuthorizationError extends Data.TaggedError("AuthorizationError")<{
  readonly message: string
  readonly resource?: string
  readonly action?: string
  readonly cause?: unknown
}> {}

export class TokenError extends Data.TaggedError("TokenError")<{
  readonly message: string
  readonly tokenType?: string
  readonly cause?: unknown
}> {}

export class TokenExpiredError extends Data.TaggedError("TokenExpiredError")<{
  readonly message: string
  readonly expiredAt?: Date
}> {}

/**
 * Configuration errors
 */
export class ConfigurationError extends Data.TaggedError("ConfigurationError")<{
  readonly message: string
  readonly key?: string
  readonly value?: unknown
  readonly cause?: unknown
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string
  readonly field?: string
  readonly value?: unknown
  readonly cause?: unknown
}> {}

/**
 * Server-specific errors
 */
export class ServerError extends Data.TaggedError("ServerError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class ServerNotInitializedError extends Data.TaggedError("ServerNotInitializedError")<{
  readonly message?: string
}> {}

export class ServerShutdownError extends Data.TaggedError("ServerShutdownError")<{
  readonly message: string
  readonly reason?: string
}> {}

/**
 * Client-specific errors
 */
export class ClientError extends Data.TaggedError("ClientError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class ClientNotConnectedError extends Data.TaggedError("ClientNotConnectedError")<{
  readonly message?: string
}> {}

export class RequestCancelledError extends Data.TaggedError("RequestCancelledError")<{
  readonly message: string
  readonly requestId?: string | number
}> {}

/**
 * Sampling (LLM) errors
 */
export class SamplingError extends Data.TaggedError("SamplingError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class ModelError extends Data.TaggedError("ModelError")<{
  readonly message: string
  readonly model?: string
  readonly cause?: unknown
}> {}

export class TokenLimitError extends Data.TaggedError("TokenLimitError")<{
  readonly message: string
  readonly limit: number
  readonly actual?: number
}> {}

/**
 * Internal errors
 */
export class InternalError extends Data.TaggedError("InternalError")<{
  readonly message: string
  readonly cause?: unknown
  readonly context?: Record<string, unknown>
}> {}

export class NotImplementedError extends Data.TaggedError("NotImplementedError")<{
  readonly message: string
  readonly feature?: string
}> {}

/**
 * Union type of all FastMCP errors for exhaustive matching
 */
export type FastMCPErrorUnion =
  | ProtocolError
  | InvalidRequestError
  | MethodNotFoundError
  | InvalidParamsError
  | ParseError
  | TransportError
  | ConnectionError
  | TimeoutError
  | DisconnectedError
  | ToolError
  | ToolNotFoundError
  | ToolValidationError
  | ToolExecutionError
  | ResourceError
  | ResourceNotFoundError
  | ResourceAccessError
  | ResourceValidationError
  | PromptError
  | PromptNotFoundError
  | PromptValidationError
  | AuthenticationError
  | AuthorizationError
  | TokenError
  | TokenExpiredError
  | ConfigurationError
  | ValidationError
  | ServerError
  | ServerNotInitializedError
  | ServerShutdownError
  | ClientError
  | ClientNotConnectedError
  | RequestCancelledError
  | SamplingError
  | ModelError
  | TokenLimitError
  | InternalError
  | NotImplementedError

/**
 * Error utility functions
 */
export const createProtocolError = (message: string, options?: {
  method?: string
  cause?: unknown
  code?: MCPErrorCode
}): ProtocolError =>
  new ProtocolError({ message, ...options })

export const createToolError = (toolName: string, message: string, options?: {
  cause?: unknown
  isError?: boolean
}): ToolError =>
  new ToolError({ message, toolName, ...options })

export const createResourceError = (uri: string, message: string, options?: {
  cause?: unknown
}): ResourceError =>
  new ResourceError({ message, uri, ...options })

export const createValidationError = (message: string, options?: {
  field?: string
  value?: unknown
  cause?: unknown
}): ValidationError =>
  new ValidationError({ message, ...options })

/**
 * Error matching utilities for common patterns
 */
export const isProtocolError = (error: unknown): error is ProtocolError =>
  error instanceof ProtocolError

export const isToolError = (error: unknown): error is ToolError =>
  error instanceof ToolError

export const isResourceError = (error: unknown): error is ResourceError =>
  error instanceof ResourceError

export const isTransportError = (error: unknown): error is TransportError =>
  error instanceof TransportError

export const isAuthError = (error: unknown): error is AuthenticationError | AuthorizationError =>
  error instanceof AuthenticationError || error instanceof AuthorizationError

/**
 * Error conversion utilities for migrating from Python exceptions
 */
export const fromPythonException = (error: Error): FastMCPErrorUnion => {
  const message = error.message
  const cause = error.cause

  // Map common Python exception patterns to FastMCP errors
  if (error.name === "ValueError") {
    return new ValidationError({ message, cause })
  }
  if (error.name === "KeyError" || error.name === "AttributeError") {
    return new ResourceNotFoundError({ uri: "unknown", message })
  }
  if (error.name === "TimeoutError") {
    return new TimeoutError({ message, timeout: 0 })
  }
  if (error.name === "ConnectionError") {
    return new ConnectionError({ message, cause })
  }
  
  // Default to internal error
  return new InternalError({ message, cause })
}