import { describe, expect, it } from 'vitest';
import type { ZodSchema } from 'zod';
import { AdapterPool } from '../../src/server/adapters/pool.js';
import type {
  AITextAdapter,
  AdapterResult,
  HealthStatus,
  ModelConfig,
  TextResult,
  TokenUsage,
} from '../../src/server/adapters/types.js';

const mockTextAdapter: AITextAdapter = {
  provider: 'mock-text',
  healthCheck: async (): Promise<HealthStatus> => 'available',
  generateText: async (
    _prompt: string,
    _systemPrompt: string | undefined,
    _schema: ZodSchema | undefined,
    _config: ModelConfig
  ): Promise<AdapterResult<TextResult, TokenUsage>> => ({
    data: { content: 'mock result' },
    usage: { inputTokens: 1, outputTokens: 2 },
    latencyMs: 10,
    provider: 'mock-text',
    model: 'mock-model',
  }),
};

describe('AdapterPool', () => {
  it('registers and retrieves a text adapter by provider', () => {
    const pool = new AdapterPool();
    pool.registerText(mockTextAdapter);

    const adapter = pool.getText('mock-text');
    expect(adapter.provider).toBe('mock-text');
  });

  it('throws when requesting an unregistered provider', () => {
    const pool = new AdapterPool();
    expect(() => pool.getText('missing')).toThrow('Text adapter not found for provider: missing');
  });

  it('routes by task type and provider', () => {
    const pool = new AdapterPool();
    pool.registerText(mockTextAdapter);

    const adapter = pool.route('text', 'mock-text');
    expect(adapter.provider).toBe('mock-text');
  });

  it('reports empty health status when no adapters registered', async () => {
    const pool = new AdapterPool();
    const report = await pool.healthCheckAll();
    expect(report).toEqual({
      text: {},
      image: {},
      video: {},
      tts: {},
      music: {},
      render: {},
    });
  });

  it('checks health of all registered adapters', async () => {
    const pool = new AdapterPool();
    pool.registerText(mockTextAdapter);

    const report = await pool.healthCheckAll();
    expect(report).toHaveProperty('text');
    expect(report.text).toHaveProperty('mock-text', 'available');
  });
});
