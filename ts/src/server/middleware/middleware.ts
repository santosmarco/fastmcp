/**
 * FastMCP Middleware - TypeScript Implementation with Effect
 * 
 * Base middleware system using Effect for FastMCP servers.
 */

import { Effect, pipe } from "effect";
import { getLogger } from "../../utilities/logging";
import type { Context } from "../context";
import type { Tool, ToolResult } from "../../tools";
import type { Resource } from "../../resources";
import type { ResourceTemplate } from "../../resources";
import type { Prompt } from "../../prompts";

const logger = getLogger("middleware");

/**
 * Middleware errors using Effect's error handling
 */
export class MiddlewareError {
  readonly _tag = "MiddlewareError";
  constructor(readonly message: string, readonly cause?: unknown) {}
}

export class MiddlewareTimeoutError {
  readonly _tag = "MiddlewareTimeoutError";
  constructor(readonly timeout: number) {}
}

/**
 * Call next function type for middleware pipeline using Effect.
 */
export type CallNext<T, R> = (
  context: MiddlewareContext<T>
) => Effect.Effect<R, MiddlewareError>;

/**
 * Unified context for all middleware operations using Effect.
 */
export type MiddlewareContext<T> = {
  readonly message: T;
  readonly fastmcpContext?: Context;
  readonly source: "client" | "server";
  readonly type: "request" | "notification";
  readonly method?: string;
  readonly timestamp: Date;
};

/**
 * Create a middleware context.
 */
export function createMiddlewareContext<T>(
  message: T,
  options: {
    fastmcpContext?: Context;
    source?: "client" | "server";
    type?: "request" | "notification";
    method?: string;
  } = {}
): MiddlewareContext<T> {
  return {
    message,
    fastmcpContext: options.fastmcpContext,
    source: options.source || "client",
    type: options.type || "request",
    method: options.method,
    timestamp: new Date(),
  };
}

/**
 * Copy a middleware context with new properties.
 */
export function copyMiddlewareContext<T>(
  context: MiddlewareContext<T>,
  updates: Partial<MiddlewareContext<T>>
): MiddlewareContext<T> {
  return { ...context, ...updates };
}

/**
 * Create a middleware wrapper that applies a single middleware to a context using Effect.
 */
export function makeMiddlewareWrapper<T, R>(
  middleware: Middleware,
  callNext: CallNext<T, R>
): CallNext<T, R> {
  return (context: MiddlewareContext<T>) =>
    middleware.handle(context, callNext);
}

/**
 * Base class for FastMCP middleware with Effect-based dispatching hooks.
 */
export abstract class Middleware {
  /**
   * Main entry point that orchestrates the pipeline using Effect.
   */
  handle<T, R>(
    context: MiddlewareContext<T>,
    callNext: CallNext<T, R>
  ): Effect.Effect<R, MiddlewareError> {
    return pipe(
      this._dispatchHandler(context, callNext),
      Effect.flatMap((handlerChain) => handlerChain(context))
    );
  }

  /**
   * Builds a chain of handlers for a given message using Effect.
   */
  private _dispatchHandler<T, R>(
    context: MiddlewareContext<T>,
    callNext: CallNext<T, R>
  ): Effect.Effect<CallNext<T, R>, never> {
    return Effect.sync(() => {
      let handler = callNext;

      // Dispatch based on method
      switch (context.method) {
        case "tools/call":
          handler = this.onCallTool as CallNext<T, R>;
          break;
        case "resources/read":
          handler = this.onReadResource as CallNext<T, R>;
          break;
        case "prompts/get":
          handler = this.onGetPrompt as CallNext<T, R>;
          break;
        case "tools/list":
          handler = this.onListTools as CallNext<T, R>;
          break;
        case "resources/list":
          handler = this.onListResources as CallNext<T, R>;
          break;
        case "resources/templates/list":
          handler = this.onListResourceTemplates as CallNext<T, R>;
          break;
        case "prompts/list":
          handler = this.onListPrompts as CallNext<T, R>;
          break;
        default:
          // Check message vs notification
          if (context.type === "request") {
            handler = this.onRequest as CallNext<T, R>;
          } else {
            handler = this.onNotification as CallNext<T, R>;
          }
          break;
      }

      // Always apply general message handler
      const messageHandler = this.onMessage as CallNext<T, R>;
      if (messageHandler !== handler) {
        return messageHandler;
      }

      return handler;
    });
  }

  /**
   * General message handler using Effect.
   */
  onMessage<T, R>(
    context: MiddlewareContext<T>,
    callNext: CallNext<T, R>
  ): Effect.Effect<R, MiddlewareError> {
    return callNext(context);
  }

  /**
   * Request handler using Effect.
   */
  onRequest<T, R>(
    context: MiddlewareContext<T>,
    callNext: CallNext<T, R>
  ): Effect.Effect<R, MiddlewareError> {
    return callNext(context);
  }

  /**
   * Notification handler using Effect.
   */
  onNotification<T, R>(
    context: MiddlewareContext<T>,
    callNext: CallNext<T, R>
  ): Effect.Effect<R, MiddlewareError> {
    return callNext(context);
  }

  /**
   * Tool call handler using Effect.
   */
  onCallTool(
    context: MiddlewareContext<{ name: string; arguments: Record<string, unknown> }>,
    callNext: CallNext<{ name: string; arguments: Record<string, unknown> }, ToolResult>
  ): Effect.Effect<ToolResult, MiddlewareError> {
    return callNext(context);
  }

  /**
   * Resource read handler using Effect.
   */
  onReadResource(
    context: MiddlewareContext<{ uri: string }>,
    callNext: CallNext<{ uri: string }, string | Uint8Array>
  ): Effect.Effect<string | Uint8Array, MiddlewareError> {
    return callNext(context);
  }

  /**
   * Prompt get handler using Effect.
   */
  onGetPrompt(
    context: MiddlewareContext<{ name: string; arguments?: Record<string, unknown> }>,
    callNext: CallNext<{ name: string; arguments?: Record<string, unknown> }, unknown>
  ): Effect.Effect<unknown, MiddlewareError> {
    return callNext(context);
  }

  /**
   * List tools handler using Effect.
   */
  onListTools(
    context: MiddlewareContext<Record<string, unknown>>,
    callNext: CallNext<Record<string, unknown>, Tool[]>
  ): Effect.Effect<Tool[], MiddlewareError> {
    return callNext(context);
  }

  /**
   * List resources handler using Effect.
   */
  onListResources(
    context: MiddlewareContext<Record<string, unknown>>,
    callNext: CallNext<Record<string, unknown>, Resource[]>
  ): Effect.Effect<Resource[], MiddlewareError> {
    return callNext(context);
  }

  /**
   * List resource templates handler using Effect.
   */
  onListResourceTemplates(
    context: MiddlewareContext<Record<string, unknown>>,
    callNext: CallNext<Record<string, unknown>, ResourceTemplate[]>
  ): Effect.Effect<ResourceTemplate[], MiddlewareError> {
    return callNext(context);
  }

  /**
   * List prompts handler using Effect.
   */
  onListPrompts(
    context: MiddlewareContext<Record<string, unknown>>,
    callNext: CallNext<Record<string, unknown>, Prompt[]>
  ): Effect.Effect<Prompt[], MiddlewareError> {
    return callNext(context);
  }
}

/**
 * Compose multiple middleware into a single middleware using Effect.
 */
export function composeMiddleware(middlewares: Middleware[]): Middleware {
  return new (class extends Middleware {
    onMessage<T, R>(
      context: MiddlewareContext<T>,
      callNext: CallNext<T, R>
    ): Effect.Effect<R, MiddlewareError> {
      const chain = middlewares.reduceRight(
        (next, middleware) => makeMiddlewareWrapper(middleware, next),
        callNext
      );
      return chain(context);
    }
  })();
}

/**
 * Apply middleware to a function using Effect.
 */
export function applyMiddleware<T, R>(
  middlewares: Middleware[],
  handler: (input: T) => Effect.Effect<R, MiddlewareError>
): (input: T, context?: Partial<MiddlewareContext<T>>) => Effect.Effect<R, MiddlewareError> {
  const composedMiddleware = composeMiddleware(middlewares);

  return (input: T, contextOptions?: Partial<MiddlewareContext<T>>) => {
    const context = createMiddlewareContext(input, contextOptions);
    const callNext: CallNext<T, R> = (ctx) => handler(ctx.message);
    return composedMiddleware.handle(context, callNext);
  };
}