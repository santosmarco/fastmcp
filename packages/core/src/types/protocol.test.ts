/**
 * Tests for FastMCP Protocol Types
 */

import { describe, it, expect } from 'vitest'
import {
  MCP_PROTOCOL_VERSION,
  MCP_ERROR_CODES,
  type JSONRPCRequest,
  type ContentBlock,
  type Tool,
} from './protocol.js'
import { createRequest, createTextContent, isTextContent } from '../utils/index.js'
import { MCP_METHODS } from './methods.js'

describe('Protocol Types', () => {
  it('should have correct protocol version', () => {
    expect(MCP_PROTOCOL_VERSION).toBe('2024-11-05')
  })

  it('should have correct error codes', () => {
    expect(MCP_ERROR_CODES.PARSE_ERROR).toBe(-32700)
    expect(MCP_ERROR_CODES.INVALID_REQUEST).toBe(-32600)
    expect(MCP_ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601)
    expect(MCP_ERROR_CODES.TOOL_ERROR).toBe(-32000)
  })

  it('should create valid JSON-RPC request', () => {
    const request = createRequest(MCP_METHODS.LIST_TOOLS, 1, { cursor: 'test' })
    
    expect(request).toEqual({
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1,
      params: { cursor: 'test' }
    })
  })

  it('should create and validate content blocks', () => {
    const textContent = createTextContent('Hello, world!')
    
    expect(textContent).toEqual({
      type: 'text',
      text: 'Hello, world!'
    })
    
    expect(isTextContent(textContent)).toBe(true)
  })

  it('should type-check tool definition', () => {
    const tool: Tool = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        required: ['message']
      }
    }
    
    expect(tool.name).toBe('test_tool')
    expect(tool.inputSchema.type).toBe('object')
  })

  it('should handle content block unions correctly', () => {
    const textContent: ContentBlock = {
      type: 'text',
      text: 'Test message'
    }
    
    const imageContent: ContentBlock = {
      type: 'image',
      data: 'base64data',
      mimeType: 'image/png'
    }
    
    expect(textContent.type).toBe('text')
    expect(imageContent.type).toBe('image')
  })
})