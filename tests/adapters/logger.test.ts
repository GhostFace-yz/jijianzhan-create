import { describe, expect, it, vi } from 'vitest';
import {
  DefaultAICallLogger,
  NoopLogger,
} from '../../src/server/adapters/logger.js';
import { ErrorCode } from '../../src/server/adapters/error.js';
import type {
  ImageUsage,
  TokenUsage,
} from '../../src/server/adapters/types.js';

describe('NoopLogger', () => {
  it('does nothing on logCall', () => {
    const logger = new NoopLogger();
    expect(() =>
      logger.logCall({
        taskType: 'text',
        provider: 'mock',
        model: 'model',
        status: 'success',
        latencyMs: 10,
        usage: { inputTokens: 1, outputTokens: 2 } as TokenUsage,
      })
    ).not.toThrow();
  });

  it('does nothing on logFallback', () => {
    const logger = new NoopLogger();
    expect(() =>
      logger.logFallback({
        taskType: 'text',
        failedProvider: 'a',
        fallbackProvider: 'b',
        errorCode: ErrorCode.TIMEOUT,
      })
    ).not.toThrow();
  });
});

describe('DefaultAICallLogger', () => {
  it('logs call entries with provider, model, latency and usage', () => {
    const logger = new DefaultAICallLogger();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.logCall({
      taskType: 'text',
      provider: 'openai',
      model: 'gpt-4o',
      status: 'success',
      latencyMs: 120,
      usage: { inputTokens: 10, outputTokens: 20 } as TokenUsage,
      projectId: 'proj-1',
      nodeId: 'node-1',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[AI_CALL]'),
      expect.any(Object)
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('openai'),
      expect.any(Object)
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('gpt-4o'),
      expect.any(Object)
    );

    consoleSpy.mockRestore();
  });

  it('logs error status and code', () => {
    const logger = new DefaultAICallLogger();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.logCall({
      taskType: 'image',
      provider: 'mock',
      model: 'model',
      status: 'error',
      latencyMs: 50,
      usage: { credits: 0 } as ImageUsage,
      errorCode: ErrorCode.TIMEOUT,
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[AI_CALL]'),
      expect.objectContaining({ errorCode: ErrorCode.TIMEOUT })
    );

    consoleSpy.mockRestore();
  });

  it('logs fallback events', () => {
    const logger = new DefaultAICallLogger();
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logger.logFallback({
      taskType: 'text',
      failedProvider: 'primary',
      fallbackProvider: 'backup',
      errorCode: ErrorCode.RATE_LIMIT,
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[AI_FALLBACK]'),
      expect.any(Object)
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('primary'),
      expect.any(Object)
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('backup'),
      expect.any(Object)
    );

    consoleSpy.mockRestore();
  });

  it('does not expose apiKey in log metadata', () => {
    const logger = new DefaultAICallLogger();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.logCall({
      taskType: 'text',
      provider: 'openai',
      model: 'gpt-4o',
      status: 'success',
      latencyMs: 100,
      usage: { inputTokens: 1, outputTokens: 2 } as TokenUsage,
      metadata: { apiKey: 'secret-key-123' },
    });

    const logged = consoleSpy.mock.calls[0]?.[0] as string | undefined;
    expect(logged).not.toContain('secret-key-123');
    expect(logged).not.toContain('apiKey');

    consoleSpy.mockRestore();
  });
});
