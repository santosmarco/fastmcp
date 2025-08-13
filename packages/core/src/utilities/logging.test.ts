/**
 * Tests for FastMCP Logging System
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { 
  createLogger, 
  getLogger, 
  withLoggingContext, 
  logExecutionTime,
  createRequestLogger,
  FastMCPLogLevel
} from './logging.js'

describe('FastMCP Logging System', () => {
  it('should create logger with component context', async () => {
    const logger = createLogger({ component: 'test' })
    expect(logger).toBeDefined()
    
    // Test that we can call logging methods without errors
    const program = Effect.gen(function* () {
      yield* logger.debug('Debug message')
      yield* logger.info('Info message')
      yield* logger.warning('Warning message')
    })

    await Effect.runPromise(program)
  })

  it('should get logger with component name', () => {
    const logger = getLogger('test-component')
    expect(logger).toBeDefined()
  })

  it('should create request logger with request ID', () => {
    const logger = createRequestLogger('req-123', 'user-456')
    expect(logger).toBeDefined()
  })

  it('should handle logging context', async () => {
    const program = Effect.gen(function* () {
      yield* withLoggingContext(
        { component: 'test', requestId: 'req-123' },
        Effect.gen(function* () {
          const logger = getLogger()
          yield* logger.info('Message with context')
        })
      )
    })

    await Effect.runPromise(program)
  })

  it('should measure execution time', async () => {
    const logger = getLogger('performance')
    
    const program = Effect.gen(function* () {
      const result = yield* logger.time('test-operation', 
        Effect.gen(function* () {
          yield* Effect.sleep('10 millis')
          return 'success'
        })
      )
      expect(result).toBe('success')
    })

    await Effect.runPromise(program)
  })

  it('should handle log execution time utility', async () => {
    const program = Effect.gen(function* () {
      const result = yield* logExecutionTime('test-util-operation',
        Effect.gen(function* () {
          yield* Effect.sleep('5 millis')
          return 'completed'
        })
      )
      expect(result).toBe('completed')
    })

    await Effect.runPromise(program)
  })

  it('should have correct log levels', () => {
    expect(FastMCPLogLevel.DEBUG).toBeDefined()
    expect(FastMCPLogLevel.INFO).toBeDefined()
    expect(FastMCPLogLevel.WARNING).toBeDefined()
    expect(FastMCPLogLevel.ERROR).toBeDefined()
    expect(FastMCPLogLevel.CRITICAL).toBeDefined()
  })

  it('should chain logger context modifications', () => {
    const logger = getLogger('base')
      .withComponent('new-component')
      .withRequestId('req-789')
      .withUserId('user-123')
    
    expect(logger).toBeDefined()
  })
})