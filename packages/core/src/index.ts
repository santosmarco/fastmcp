/**
 * @fastmcp/core - Core Types and Utilities for FastMCP TypeScript + Effect
 * 
 * This package provides the foundational types, error system, validation schemas,
 * and utilities for building FastMCP servers and clients with TypeScript and Effect.
 */

// Core protocol types
export * from "./types/protocol.js"
export * from "./types/methods.js"

// Error system
export * from "./errors/index.js"

// Schema validation
export * from "./schema/index.js"

// Utilities
export * from "./utils/index.js"

// Transport layer
export * from "./transport/index.js"

/**
 * Version information
 */
export const VERSION = "0.1.0"

/**
 * FastMCP Core Library Information
 */
export const FASTMCP_INFO = {
  name: "@fastmcp/core",
  version: VERSION,
  description: "Core types and utilities for FastMCP TypeScript + Effect",
  author: "FastMCP Team",
  license: "Apache-2.0",
} as const