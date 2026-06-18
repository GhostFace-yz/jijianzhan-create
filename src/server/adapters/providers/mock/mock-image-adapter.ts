import { BaseAdapter } from '../../base-adapter.js';
import type {
  AIImageAdapter,
  AdapterResult,
  ImageResult,
  ImageUsage,
  ModelConfig,
} from '../../types.js';

/**
 * Mock 图像 Adapter
 */
export class MockImageAdapter extends BaseAdapter implements AIImageAdapter {
  constructor() {
    super('mock-image');
  }

  async generateImage(
    params: {
      prompt: string;
      negativePrompt?: string;
      referenceImages?: string[];
      seed?: number;
      width?: number;
      height?: number;
      stylePreset?: string;
    },
    config: ModelConfig
  ): Promise<AdapterResult<ImageResult, ImageUsage>> {
    const { result, latencyMs } = await this.measureLatency(async () => {
      const seed = params.seed ?? 42;
      return {
        url: `https://mock-cdn.example.com/image/${seed}.png`,
        seed,
      };
    });

    return {
      data: result,
      usage: { credits: 1 },
      latencyMs,
      provider: this.provider,
      model: config.model,
    };
  }
}
