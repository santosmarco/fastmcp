/**
 * FastMCP Context - TypeScript Implementation with Effect
 * 
 * Provides access to MCP capabilities within tool and resource functions using Effect.
 */

import { AsyncLocalStorage } from "async_hooks";
import { Effect, pipe } from "effect";
import {
  ServerSession,
  LoggingLevel,
  ContentBlock,
  SamplingMessage,
  TextContent,
  CreateMessageResult,
  IncludeContext,
  ModelPreferences,
  ModelHint,
  Root,
  ReadResourceContents,
} from "@modelcontextprotocol/sdk/types";
import { getLogger } from "../utilities/logging";
import type { FastMCP } from "./server";

const logger = getLogger("context");

/**
 * Context errors using Effect's error handling
 */
export class ContextNotAvailableError {
  readonly _tag = "ContextNotAvailableError";
  constructor(readonly message: string = "Context is not available outside of a request") {}
}

export class NotificationError {
  readonly _tag = "NotificationError";
  constructor(readonly message: string, readonly cause?: unknown) {}
}

export class ResourceReadError {
  readonly _tag = "ResourceReadError";
  constructor(readonly uri: string, readonly cause?: unknown) {}
}

export class SamplingError {
  readonly _tag = "SamplingError";
  constructor(readonly message: string, readonly cause?: unknown) {}
}

export class ElicitationError {
  readonly _tag = "ElicitationError";
  constructor(readonly message: string, readonly cause?: unknown) {}
}

// Context variable for async local storage
const contextStorage = new AsyncLocalStorage<Context>();

// Flush lock to prevent concurrent notification flushes
let flushLock = false;

/**
 * Set context for the current async scope using Effect
 */
export function setContext<T>(context: Context, fn: () => T): T {
  return contextStorage.run(context, fn);
}

/**
 * Get the current context from async local storage using Effect
 */
export function getCurrentContext(): Effect.Effect<Context, ContextNotAvailableError> {
  const context = contextStorage.getStore();
  return context
    ? Effect.succeed(context)
    : Effect.fail(new ContextNotAvailableError());
}

/**
 * Context object providing access to MCP capabilities using Effect.
 *
 * This provides a cleaner interface to MCP's RequestContext functionality.
 * It gets injected into tool and resource functions that request it via type hints.
 *
 * Example usage:
 * ```typescript
 * @server.tool
 * async function myTool(x: number, ctx: Context): Promise<string> {
 *   // Log messages to the client using Effect
 *   await Effect.runPromise(ctx.info(`Processing ${x}`));
 *   await Effect.runPromise(ctx.debug("Debug info"));
 *   await Effect.runPromise(ctx.warning("Warning message"));
 *   await Effect.runPromise(ctx.error("Error message"));
 *
 *   // Report progress using Effect
 *   await Effect.runPromise(ctx.reportProgress(50, 100, "Processing"));
 *
 *   // Access resources using Effect
 *   const data = await Effect.runPromise(ctx.readResource("resource://data"));
 *
 *   // Get request info
 *   const requestId = ctx.requestId;
 *   const clientId = ctx.clientId;
 *
 *   // Manage state across the request
 *   ctx.setState("key", "value");
 *   const value = ctx.getState("key");
 *
 *   return String(x);
 * }
 * ```
 */
export class Context {
  readonly fastmcp: FastMCP;
  private readonly _notificationQueue: Set<string> = new Set();
  private readonly _state: Map<string, unknown> = new Map();

  constructor(fastmcp: FastMCP) {
    this.fastmcp = fastmcp;
  }

  /**
   * Enter the context manager and set this context as the current context using Effect.
   */
  enter(): Effect.Effect<Context, never> {
    return pipe(
      Effect.sync(() => {
        const parentContext = contextStorage.getStore();
        if (parentContext) {
          // Inherit state from parent context
          for (const [key, value] of parentContext._state) {
            this._state.set(key, structuredClone(value));
          }
        }
        return this;
      })
    );
  }

  /**
   * Exit the context manager and flush any remaining notifications using Effect.
   */
  exit(): Effect.Effect<void, NotificationError> {
    return this._flushNotifications();
  }

  /**
   * Access to the underlying request context using Effect.
   */
  get requestContext(): Effect.Effect<Record<string, unknown>, ContextNotAvailableError> {
    // This would need to be implemented based on the actual MCP SDK
    return Effect.succeed({});
  }

  /**
   * Report progress for the current operation using Effect.
   */
  reportProgress(
    progress: number,
    total?: number,
    message?: string
  ): Effect.Effect<void, never> {
    return Effect.sync(() => {
      logger.debug(`Progress: ${progress}${total ? `/${total}` : ""} ${message || ""}`);
    });
  }

  /**
   * Read a resource by URI using Effect.
   */
  readResource(uri: string): Effect.Effect<ReadResourceContents[], ResourceReadError> {
    return Effect.tryPromise({
      try: async () => {
        if (!this.fastmcp) {
          throw new Error("FastMCP instance not available");
        }
        return await this.fastmcp._mcpReadResource(uri);
      },
      catch: (error) => new ResourceReadError(uri, error),
    });
  }

  /**
   * Send a log message to the client using Effect.
   */
  log(
    message: string,
    level: LoggingLevel = "info",
    loggerName?: string
  ): Effect.Effect<void, never> {
    return Effect.sync(() => {
      logger.log(level as any, message, { logger: loggerName });
    });
  }

  /**
   * Get the client ID if available.
   */
  get clientId(): string | undefined {
    // This would need to be extracted from the request context
    return undefined;
  }

  /**
   * Get the unique ID for this request.
   */
  get requestId(): string {
    // This would need to be extracted from the request context
    return "unknown";
  }

  /**
   * Get the MCP session ID for ALL transports.
   */
  get sessionId(): string {
    // This would need to be implemented based on the transport
    return "unknown";
  }

  /**
   * Access to the underlying session for advanced usage.
   */
  get session(): ServerSession | undefined {
    // This would need to be implemented based on the MCP SDK
    return undefined;
  }

  // Convenience methods for common log levels using Effect
  debug(message: string, loggerName?: string): Effect.Effect<void, never> {
    return this.log(message, "debug", loggerName);
  }

  info(message: string, loggerName?: string): Effect.Effect<void, never> {
    return this.log(message, "info", loggerName);
  }

  warning(message: string, loggerName?: string): Effect.Effect<void, never> {
    return this.log(message, "warning", loggerName);
  }

  error(message: string, loggerName?: string): Effect.Effect<void, never> {
    return this.log(message, "error", loggerName);
  }

  /**
   * List the roots available to the server using Effect.
   */
  listRoots(): Effect.Effect<Root[], never> {
    return Effect.succeed([]);
  }

  /**
   * Send a tool list changed notification to the client using Effect.
   */
  sendToolListChanged(): Effect.Effect<void, NotificationError> {
    return this._queueNotification("notifications/tools/list_changed");
  }

  /**
   * Send a resource list changed notification to the client using Effect.
   */
  sendResourceListChanged(): Effect.Effect<void, NotificationError> {
    return this._queueNotification("notifications/resources/list_changed");
  }

  /**
   * Send a prompt list changed notification to the client using Effect.
   */
  sendPromptListChanged(): Effect.Effect<void, NotificationError> {
    return this._queueNotification("notifications/prompts/list_changed");
  }

  /**
   * Send a sampling request to the client and await the response using Effect.
   */
  sample(
    messages: string | Array<string | SamplingMessage>,
    systemPrompt?: string,
    includeContext?: IncludeContext,
    temperature?: number,
    maxTokens?: number,
    modelPreferences?: ModelPreferences | string | string[]
  ): Effect.Effect<ContentBlock, SamplingError> {
    return Effect.fail(new SamplingError("Sampling not implemented in TypeScript translation"));
  }

  /**
   * Send an elicitation request to the client and await the response using Effect.
   */
  elicit<T>(
    message: string,
    responseType?: new () => T | string[]
  ): Effect.Effect<T | string | Record<string, unknown>, ElicitationError> {
    return Effect.fail(new ElicitationError("Elicitation not implemented in TypeScript translation"));
  }

  /**
   * Set a value in the context state.
   */
  setState(key: string, value: unknown): void {
    this._state.set(key, value);
  }

  /**
   * Get a value from the context state.
   */
  getState(key: string): unknown {
    return this._state.get(key);
  }

  /**
   * Queue a notification for later sending using Effect.
   */
  private _queueNotification(notification: string): Effect.Effect<void, NotificationError> {
    return pipe(
      Effect.sync(() => {
        this._notificationQueue.add(notification);
      }),
      Effect.flatMap(() => this._tryFlushNotifications())
    );
  }

  /**
   * Try to flush notifications if not already flushing using Effect.
   */
  private _tryFlushNotifications(): Effect.Effect<void, NotificationError> {
    if (flushLock) {
      return Effect.void;
    }

    return pipe(
      this._flushNotifications(),
      Effect.catchAll((error) => {
        logger.error("Failed to flush notifications:", error);
        return Effect.void;
      })
    );
  }

  /**
   * Send all queued notifications using Effect.
   */
  private _flushNotifications(): Effect.Effect<void, NotificationError> {
    return Effect.tryPromise({
      try: async () => {
        if (flushLock || this._notificationQueue.size === 0) {
          return;
        }

        flushLock = true;
        try {
          // Implementation would depend on the MCP session
          // For now, just log the notifications
          for (const notification of this._notificationQueue) {
            logger.debug(`Sending notification: ${notification}`);
          }
          this._notificationQueue.clear();
        } finally {
          flushLock = false;
        }
      },
      catch: (error) => new NotificationError("Failed to flush notifications", error),
    });
  }

  /**
   * Parse model preferences from various input formats using Effect.
   */
  private _parseModelPreferences(
    modelPreferences: ModelPreferences | string | string[] | undefined
  ): Effect.Effect<ModelPreferences | undefined, ElicitationError> {
    return Effect.try({
      try: () => {
        if (!modelPreferences) {
          return undefined;
        }

        if (typeof modelPreferences === "object" && "hints" in modelPreferences) {
          return modelPreferences;
        }

        if (typeof modelPreferences === "string") {
          return { hints: [{ name: modelPreferences }] };
        }

        if (Array.isArray(modelPreferences)) {
          if (!modelPreferences.every((h) => typeof h === "string")) {
            throw new Error("All elements of model_preferences list must be strings");
          }
          return {
            hints: modelPreferences.map((name) => ({ name })),
          };
        }

        throw new Error(
          "model_preferences must be one of: ModelPreferences, string, string[], or undefined"
        );
      },
      catch: (error) => new ElicitationError("Failed to parse model preferences", error),
    });
  }
}