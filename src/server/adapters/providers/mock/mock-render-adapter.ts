import { BaseAdapter } from '../../base-adapter.js';
import type {
  AIRenderAdapter,
  AdapterResult,
  ModelConfig,
  RenderMixTrack,
  RenderResult,
  RenderSubtitleCue,
  RenderTransition,
  RenderUsage,
} from '../../types.js';

/**
 * Mock 合成输出 Adapter
 *
 * 行为：
 * - 正常返回固定 pattern 的最终 MP4 URL 与总时长
 * - 支持 config.extraParams?.fail === true 模拟失败（用于 fallback 测试）
 * - 支持 config.extraParams?.urlOverride 覆盖返回 URL（用于测试）
 */
export class MockRenderAdapter extends BaseAdapter implements AIRenderAdapter {
  constructor(provider = 'mock-render') {
    super(provider);
  }

  async composeEpisode(
    params: {
      videoClips: Array<{ url: string; duration: number; freezeExtend?: number }>;
      audioClips: Array<{ url: string; duration: number; startTime: number }>;
      musicSegments: RenderMixTrack[];
      transitions: RenderTransition[];
      subtitleCues: RenderSubtitleCue[];
      resolution: string;
      fps: number;
      codec: string;
    },
    config: ModelConfig,
  ): Promise<AdapterResult<RenderResult, RenderUsage>> {
    if (config.extraParams?.fail === true) {
      throw new Error(`Mock render failed for provider: ${config.provider}`);
    }

    const { result, latencyMs } = await this.measureLatency(async () => {
      const totalDuration = params.videoClips.reduce(
        (sum, clip) => sum + clip.duration + (clip.freezeExtend ?? 0),
        0,
      );

      const urlOverride =
        typeof config.extraParams?.urlOverride === 'string'
          ? (config.extraParams.urlOverride as string)
          : undefined;
      const seed = Math.floor(Math.random() * 1_000_000);
      const url =
        urlOverride ?? `https://mock-cdn.example.com/render/${params.resolution}/${seed}.mp4`;

      return {
        url,
        duration: Math.max(0, Math.round(totalDuration * 100) / 100),
        resolution: params.resolution,
        fps: params.fps,
        codec: params.codec,
      };
    });

    return {
      data: result,
      usage: {
        credits: 10,
        durationSec: result.duration,
        cpuCoreSeconds: 0,
        outputFileSizeBytes: 0,
      },
      latencyMs,
      provider: this.provider,
      model: config.model,
    };
  }
}
