import { describe, expect, it } from 'vitest';
import { BaseAdapter } from '../../src/server/adapters/base-adapter.js';
import type { HealthStatus, ModelConfig } from '../../src/server/adapters/types.js';

class TestAdapter extends BaseAdapter {
  constructor() {
    super('test-provider');
  }

  async customCall(config: ModelConfig): Promise<string> {
    return this.resolveApiKey(config);
  }
}

describe('BaseAdapter', () => {
  it('exposes provider name', () => {
    const adapter = new TestAdapter();
    expect(adapter.provider).toBe('test-provider');
  });

  it('defaults health check to available', async () => {
    const adapter = new TestAdapter();
    expect(await adapter.healthCheck()).toBe('available');
  });

  it('uses apiKey from config', async () => {
    const adapter = new TestAdapter();
    const key = await adapter.customCall({
      provider: 'test-provider',
      model: 'test-model',
      apiKey: 'config-key',
    });
    expect(key).toBe('config-key');
  });

  it('falls back to environment variable for apiKey', async () => {
    process.env.AI_TEST_PROVIDER_API_KEY = 'env-key';
    const adapter = new TestAdapter();
    const key = await adapter.customCall({
      provider: 'test-provider',
      model: 'test-model',
    });
    expect(key).toBe('env-key');
    delete process.env.AI_TEST_PROVIDER_API_KEY;
  });

  it('throws when apiKey is missing', async () => {
    delete process.env.AI_TEST_PROVIDER_API_KEY;
    const adapter = new TestAdapter();
    await expect(
      adapter.customCall({ provider: 'test-provider', model: 'test-model' })
    ).rejects.toThrow('API key not configured for provider: test-provider');
  });
});
