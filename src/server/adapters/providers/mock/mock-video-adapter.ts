import { BaseAdapter } from '../../base-adapter.js';
import type {
  AIVideoAdapter,
  AdapterResult,
  ModelConfig,
  VideoResult,
  VideoUsage,
} from '../../types.js';

/**
 * Mock 视频生成 Adapter
 *
 * 行为：
 * - 正常返回一个固定 pattern 的视频 URL 和请求时长
 * - 支持通过 config.extraParams?.fail === true 模拟失败（用于测试 fallback）
 * - 支持通过 config.extraParams?.durationOverride 覆盖返回时长（用于测试质量检测）
 */
export class MockVideoAdapter extends BaseAdapter implements AIVideoAdapter {
  constructor(provider = 'mock-video') {
    super(provider);
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
    config: ModelConfig,
  ): Promise<AdapterResult<VideoResult, VideoUsage>> {
    if (config.extraParams?.fail === true) {
      throw new Error(`Mock video generation failed for provider: ${config.provider}`);
    }

    const { result, latencyMs } = await this.measureLatency(async () => {
      const duration =
        typeof config.extraParams?.durationOverride === 'number'
          ? (config.extraParams.durationOverride as number)
          : params.duration;

      const seed = Math.floor(Math.random() * 1_000_000);
      return {
        url: `https://mock-cdn.example.com/video/${seed}.mp4`,
        duration: Math.max(1, duration),
      };
    });

    return {
      data: result,
      usage: { credits: 5, durationSec: result.duration },
      latencyMs,
      provider: this.provider,
      model: config.model,
    };
  }
}
