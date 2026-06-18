import { describe, expect, it } from 'vitest';
import { MockImageAdapter } from '../../src/server/adapters/providers/mock/mock-image-adapter.js';
import { MockMusicAdapter } from '../../src/server/adapters/providers/mock/mock-music-adapter.js';
import { MockTTSAdapter } from '../../src/server/adapters/providers/mock/mock-tts-adapter.js';
import { MockTextAdapter } from '../../src/server/adapters/providers/mock/mock-text-adapter.js';
import { MockVideoAdapter } from '../../src/server/adapters/providers/mock/mock-video-adapter.js';
import {
  AIImageAdapter,
  AIMusicAdapter,
  AITTSAdapter,
  AITextAdapter,
  AIVideoAdapter,
} from '../../src/server/adapters/types.js';

describe('Mock adapters implement interfaces', () => {
  it('MockTextAdapter implements AITextAdapter', async () => {
    const adapter: AITextAdapter = new MockTextAdapter();
    expect(adapter.provider).toBe('mock-text');
    expect(typeof adapter.healthCheck).toBe('function');
    expect(typeof adapter.generateText).toBe('function');

    const result = await adapter.generateText('hello', 'system', undefined, {
      provider: 'mock-text',
      model: 'mock-model',
    });
    expect(result.data.content).toContain('[system]');
    expect(result.provider).toBe('mock-text');
  });

  it('MockImageAdapter implements AIImageAdapter', async () => {
    const adapter: AIImageAdapter = new MockImageAdapter();
    expect(adapter.provider).toBe('mock-image');

    const result = await adapter.generateImage(
      { prompt: 'a cat', width: 512, height: 512 },
      { provider: 'mock-image', model: 'mock-model' }
    );
    expect(result.data.url).toContain('mock-cdn');
    expect(result.usage.credits).toBe(1);
  });

  it('MockVideoAdapter implements AIVideoAdapter', async () => {
    const adapter: AIVideoAdapter = new MockVideoAdapter();
    expect(adapter.provider).toBe('mock-video');

    const result = await adapter.generateVideo(
      { duration: 5 },
      { provider: 'mock-video', model: 'mock-model' }
    );
    expect(result.data.duration).toBe(5);
    expect(result.usage.credits).toBe(5);
  });

  it('MockTTSAdapter implements AITTSAdapter', async () => {
    const adapter: AITTSAdapter = new MockTTSAdapter();
    expect(adapter.provider).toBe('mock-tts');

    const result = await adapter.generateSpeech(
      { text: '你好世界', voiceId: 'voice-1' },
      { provider: 'mock-tts', model: 'mock-model' }
    );
    expect(result.data.url).toContain('voice-1');
    expect(result.data.duration).toBeGreaterThan(0);
  });

  it('MockMusicAdapter implements AIMusicAdapter', async () => {
    const adapter: AIMusicAdapter = new MockMusicAdapter();
    expect(adapter.provider).toBe('mock-music');

    const result = await adapter.generateMusic(
      { styleTags: ['epic', 'orchestral'], duration: 30 },
      { provider: 'mock-music', model: 'mock-model' }
    );
    expect(result.data.duration).toBe(30);
    expect(result.usage.credits).toBe(2);
  });

  it('all adapters report available by default', async () => {
    const adapters = [
      new MockTextAdapter(),
      new MockImageAdapter(),
      new MockVideoAdapter(),
      new MockTTSAdapter(),
      new MockMusicAdapter(),
    ];

    for (const adapter of adapters) {
      expect(await adapter.healthCheck()).toBe('available');
    }
  });
});
