import { BaseAdapter } from '../../base-adapter.js';
import type {
  AITTSAdapter,
  AdapterResult,
  ModelConfig,
  TTSResult,
  TTSUsage,
} from '../../types.js';

/**
 * Mock TTS Adapter
 */
export class MockTTSAdapter extends BaseAdapter implements AITTSAdapter {
  constructor() {
    super('mock-tts');
  }

  async generateSpeech(
    params: {
      text: string;
      voiceId: string;
      emotion?: string;
      speed?: number;
    },
    config: ModelConfig
  ): Promise<AdapterResult<TTSResult, TTSUsage>> {
    const { result, latencyMs } = await this.measureLatency(async () => {
      const duration = Math.max(1, Math.ceil(params.text.length / 5));
      return {
        url: `https://mock-cdn.example.com/tts/${params.voiceId}-${Date.now()}.mp3`,
        duration,
      };
    });

    return {
      data: result,
      usage: { credits: 1, durationSec: result.duration },
      latencyMs,
      provider: this.provider,
      model: config.model,
    };
  }
}
