import { describe, expect, it, vi } from 'vitest';
import type { ZodSchema } from 'zod';
import { AdapterError, ErrorCode } from '../../src/server/adapters/error.js';
import { NoopLogger } from '../../src/server/adapters/logger.js';
import { AdapterPool } from '../../src/server/adapters/pool.js';
import { FallbackRouter } from '../../src/server/adapters/router.js';
import type {
  AITextAdapter,
  AdapterResult,
  HealthStatus,
  ModelBinding,
  ModelConfig,
  TextResult,
  TokenUsage,
} from '../../src/server/adapters/types.js';

function createMockAdapter(
  provider: string,
  behavior: 'success' | 'retryable' | 'non-retryable' | 'unhealthy'
): AITextAdapter {
  return {
    provider,
    healthCheck: async (): Promise<HealthStatus> =>
      behavior === 'unhealthy' ? 'unavailable' : 'available',
    generateText: async (
      _prompt: string,
      _systemPrompt: string | undefined,
      _schema: ZodSchema | undefined,
      config: ModelConfig
    ): Promise<AdapterResult<TextResult, TokenUsage>> => {
      if (behavior === 'success' || behavior === 'unhealthy') {
        return {
          data: { content: `result from ${provider}` },
          usage: { inputTokens: 1, outputTokens: 2 },
          latencyMs: 10,
          provider,
          model: config.model,
        };
      }
      if (behavior === 'retryable') {
        throw new AdapterError(ErrorCode.TIMEOUT, `timeout from ${provider}`, true);
      }
      throw new AdapterError(ErrorCode.BAD_REQUEST, `bad request from ${provider}`, false);
    },
  };
}

const modelBinding: ModelBinding<'text'> = {
  taskType: 'text',
  primary: { provider: 'primary', model: 'primary-model' },
  fallbacks: [
    { provider: 'fallback-1', model: 'fallback-1-model' },
    { provider: 'fallback-2', model: 'fallback-2-model' },
  ],
};

describe('FallbackRouter', () => {
  it('returns primary result when primary succeeds', async () => {
    const pool = new AdapterPool();
    pool.registerText(createMockAdapter('primary', 'success'));
    const router = new FallbackRouter(pool, new NoopLogger());

    const result = await router.execute(modelBinding, async (adapter, config) =>
      adapter.generateText('hello', undefined, undefined, config)
    );

    expect(result.data.content).toBe('result from primary');
    expect(result.provider).toBe('primary');
  });

  it('switches to fallback when primary fails with retryable error', async () => {
    const pool = new AdapterPool();
    pool.registerText(createMockAdapter('primary', 'retryable'));
    pool.registerText(createMockAdapter('fallback-1', 'success'));
    const router = new FallbackRouter(pool, new NoopLogger());

    const result = await router.execute(modelBinding, async (adapter, config) =>
      adapter.generateText('hello', undefined, undefined, config)
    );

    expect(result.data.content).toBe('result from fallback-1');
    expect(result.provider).toBe('fallback-1');
  });

  it('does not fallback on non-retryable errors', async () => {
    const pool = new AdapterPool();
    pool.registerText(createMockAdapter('primary', 'non-retryable'));
    pool.registerText(createMockAdapter('fallback-1', 'success'));
    const router = new FallbackRouter(pool, new NoopLogger());

    await expect(
      router.execute(modelBinding, async (adapter, config) =>
        adapter.generateText('hello', undefined, undefined, config)
      )
    ).rejects.toMatchObject({
      code: ErrorCode.BAD_REQUEST,
      retryable: false,
    });
  });

  it('skips unhealthy adapters and uses fallback', async () => {
    const pool = new AdapterPool();
    pool.registerText(createMockAdapter('primary', 'unhealthy'));
    pool.registerText(createMockAdapter('fallback-1', 'success'));
    await pool.healthCheckAll();
    const router = new FallbackRouter(pool, new NoopLogger());

    const result = await router.execute(modelBinding, async (adapter, config) =>
      adapter.generateText('hello', undefined, undefined, config)
    );

    expect(result.data.content).toBe('result from fallback-1');
  });

  it('tries the full fallback chain and throws the last error', async () => {
    const pool = new AdapterPool();
    pool.registerText(createMockAdapter('primary', 'retryable'));
    pool.registerText(createMockAdapter('fallback-1', 'retryable'));
    pool.registerText(createMockAdapter('fallback-2', 'retryable'));
    const router = new FallbackRouter(pool, new NoopLogger());

    await expect(
      router.execute(modelBinding, async (adapter, config) =>
        adapter.generateText('hello', undefined, undefined, config)
      )
    ).rejects.toMatchObject({
      code: ErrorCode.TIMEOUT,
    });
  });

  it('calls logger with fallback event metadata', async () => {
    const pool = new AdapterPool();
    pool.registerText(createMockAdapter('primary', 'retryable'));
    pool.registerText(createMockAdapter('fallback-1', 'success'));
    const logger = new NoopLogger();
    const logSpy = vi.spyOn(logger, 'logFallback');
    const router = new FallbackRouter(pool, logger);

    await router.execute(modelBinding, async (adapter, config) =>
      adapter.generateText('hello', undefined, undefined, config)
    );

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: 'text',
        failedProvider: 'primary',
        fallbackProvider: 'fallback-1',
      })
    );
  });
});
