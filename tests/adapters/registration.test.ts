import { describe, expect, it } from 'vitest';
import {
  createDefaultAdapterPool,
  registerAdapters,
} from '../../src/server/adapters/index.js';
import { AdapterPool } from '../../src/server/adapters/pool.js';

describe('registerAdapters', () => {
  it('registers all five task type adapters', () => {
    const pool = registerAdapters(new AdapterPool());
    const providers = pool.listProviders();

    const taskTypes = new Set(providers.map((p) => p.taskType));
    expect(taskTypes).toContain('text');
    expect(taskTypes).toContain('image');
    expect(taskTypes).toContain('video');
    expect(taskTypes).toContain('tts');
    expect(taskTypes).toContain('music');
  });

  it('registers mock providers under expected ids', () => {
    const pool = createDefaultAdapterPool();

    expect(pool.getText('mock-text').provider).toBe('mock-text');
    expect(pool.getImage('mock-image').provider).toBe('mock-image');
    expect(pool.getVideo('mock-video').provider).toBe('mock-video');
    expect(pool.getTTS('mock-tts').provider).toBe('mock-tts');
    expect(pool.getMusic('mock-music').provider).toBe('mock-music');
  });

  it('business code can route without knowing concrete provider', async () => {
    const pool = createDefaultAdapterPool();
    const textAdapter = pool.route('text', 'mock-text');

    const result = await textAdapter.generateText('hello', undefined, undefined, {
      provider: 'mock-text',
      model: 'mock-model',
    });

    expect(result.provider).toBe('mock-text');
    expect(result.data.content).toContain('hello');
  });
});
