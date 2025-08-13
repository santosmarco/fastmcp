/**
 * Tests for Stdio Transport
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Effect, Scope } from 'effect'
import { StdioTransport, createStdioTransport, stdioTransportConfig } from './stdio.js'
import { createRequest } from '../utils/index.js'
import { MCP_METHODS } from '../types/methods.js'

describe('StdioTransport', () => {
  it('should create stdio transport with correct config', async () => {
    const config = stdioTransportConfig()
    expect(config).toEqual({ type: 'stdio' })

    const program = Effect.gen(function* () {
      const transport = yield* createStdioTransport(config)
      const state = yield* transport.getState
      expect(state).toBe('disconnected')
      
      const stats = yield* transport.getStats
      expect(stats.messagesSent).toBe(0)
      expect(stats.messagesReceived).toBe(0)
      
      return transport
    })

    await Effect.runPromise(Effect.scoped(program))
  })

  it('should handle transport state correctly', async () => {
    const config = stdioTransportConfig()

    const program = Effect.gen(function* () {
      const transport = yield* createStdioTransport(config)
      
      // Initial state should be disconnected
      const initialState = yield* transport.getState
      expect(initialState).toBe('disconnected')
      
      const isConnected = yield* transport.isConnected
      expect(isConnected).toBe(false)
      
      return transport
    })

    await Effect.runPromise(Effect.scoped(program))
  })

  it('should create requests correctly', () => {
    const request = createRequest(MCP_METHODS.LIST_TOOLS, 1, { cursor: 'test' })
    
    expect(request).toEqual({
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1,
      params: { cursor: 'test' }
    })
  })

  it('should validate transport type', () => {
    const config = stdioTransportConfig()
    expect(config.type).toBe('stdio')
  })
})