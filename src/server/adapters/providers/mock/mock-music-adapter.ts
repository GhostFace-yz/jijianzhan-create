import { BaseAdapter } from '../../base-adapter.js';
import type {
  AIMusicAdapter,
  AdapterResult,
  ModelConfig,
  MusicResult,
  MusicUsage,
} from '../../types.js';

/**
 * Mock 音乐 Adapter
 */
export class MockMusicAdapter extends BaseAdapter implements AIMusicAdapter {
  constructor() {
    super('mock-music');
  }

  async generateMusic(
    params: {
      styleTags: string[];
      emotionSequence?: string[];
      duration: number;
      instrumentPref?: string;
    },
    config: ModelConfig
  ): Promise<AdapterResult<MusicResult, MusicUsage>> {
    const { result, latencyMs } = await this.measureLatency(async () => {
      return {
        url: `https://mock-cdn.example.com/music/${params.styleTags.join('-')}-${Date.now()}.mp3`,
        duration: params.duration,
      };
    });

    return {
      data: result,
      usage: { credits: 2, durationSec: params.duration },
      latencyMs,
      provider: this.provider,
      model: config.model,
    };
  }
}
