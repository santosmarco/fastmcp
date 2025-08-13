/**
 * Tests for FastMCP Logging System
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { 
  getLogger, 
  configureLogging,
  LOG_LEVELS
} from './logging.js'

describe('FastMCP Logging System', () => {
  it('should create logger with prefixed name', () => {
    const logger = getLogger('test-component')
    expect(logger).toBeDefined()
    expect(logger.debug).toBeDefined()
    expect(logger.info).toBeDefined()
    expect(logger.warning).toBeDefined()
    expect(logger.error).toBeDefined()
    expect(logger.critical).toBeDefined()
  })

  it('should have correct log levels', () => {
    expect(LOG_LEVELS.DEBUG).toBeDefined()
    expect(LOG_LEVELS.INFO).toBeDefined()
    expect(LOG_LEVELS.WARNING).toBeDefined()
    expect(LOG_LEVELS.ERROR).toBeDefined()
    expect(LOG_LEVELS.CRITICAL).toBeDefined()
  })

  it('should configure logging with level', () => {
    const layer = configureLogging("DEBUG", true)
    expect(layer).toBeDefined()
  })

  it('should handle basic logging operations', async () => {
    const logger = getLogger('test')
    
    // These should not throw errors
    const program = Effect.gen(function* () {
      yield* logger.info('Test info message')
      yield* logger.debug('Test debug message')
      yield* logger.warning('Test warning message')
      yield* logger.error('Test error message')
      yield* logger.critical('Test critical message')
    })

    await Effect.runPromise(program)
  })
})