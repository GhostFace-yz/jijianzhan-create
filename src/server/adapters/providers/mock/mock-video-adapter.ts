import { BaseAdapter } from '../../base-adapter.js';
import type {
  AIVideoAdapter,
  AdapterResult,
  ModelConfig,
  VideoResult,
  VideoUsage,
} from '../../types.js';

/**
 * Mock 视频 Adapter
 */
export class MockVideoAdapter extends BaseAdapter implements AIVideoAdapter {
  constructor() {
    super('mock-video');
  }

  async generateVideo(
    params: {
      imageUrl?: string;
      referenceImages?: string[];
      duration: number;
      cameraMove?: string;
      motionDescription?: string;
      audioUrl?: string;
      faceEnhancement?: boolean;
    },
    config: ModelConfig
  ): Promise<AdapterResult<VideoResult, VideoUsage>> {
    const { result, latencyMs } = await this.measureLatency(async () => {
      return {
        url: `https://mock-cdn.example.com/video/${Date.now()}.mp4`,
        duration: params.duration,
      };
    });

    return {
      data: result,
      usage: { credits: 5, durationSec: params.duration },
      latencyMs,
      provider: this.provider,
      model: config.model,
    };
  }
}
