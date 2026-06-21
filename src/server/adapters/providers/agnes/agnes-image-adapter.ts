import { BaseAdapter } from '../../base-adapter.js';
import { sanitizeImagePrompt } from '../../lib/image-prompt-sanitizer.js';
import type {
  AIImageAdapter,
  AdapterResult,
  HealthStatus,
  ImageResult,
  ImageUsage,
  ModelConfig,
} from '../../types.js';

interface AgnesImageResponse {
  data?: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
  created?: number;
  error?: { message?: string };
}

/**
 * Agnes 图像生成 Adapter
 *
 * Agnes 提供 OpenAI 兼容的图像生成 API（/v1/images/generations）。
 * 使用原生 fetch 调用，便于透传参考图、seed 等 Agnes 扩展字段。
 */
export class AgnesImageAdapter extends BaseAdapter implements AIImageAdapter {
  constructor() {
    super('agnes-image');
  }

  private resolveAgnesApiKey(config: ModelConfig): string {
    const apiKey = config.apiKey ?? process.env.AGNES_IMAGE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Agnes image API key not configured. Set AGNES_IMAGE_API_KEY or pass config.apiKey.',
      );
    }
    return apiKey;
  }

  private resolveBaseUrl(config: ModelConfig): string {
    return (
      config.baseUrl ??
      process.env.AGNES_IMAGE_URL ??
      'https://apihub.agnes-ai.com'
    );
  }

  private resolveModel(config: ModelConfig): string {
    return config.model ?? process.env.AGNES_IMAGE_MODEL ?? 'agnes-image-2.0-flash';
  }

  private resolveEndpoint(config: ModelConfig): string {
    const baseUrl = this.resolveBaseUrl(config).replace(/\/$/, '');
    if (baseUrl.endsWith('/v1/images/generations')) {
      return baseUrl;
    }
    return `${baseUrl}/v1/images/generations`;
  }

  async healthCheck(): Promise<HealthStatus> {
    const apiKey = process.env.AGNES_IMAGE_API_KEY;
    const baseUrl = process.env.AGNES_IMAGE_URL;

    if (!apiKey || !baseUrl) {
      return 'unavailable';
    }

    try {
      const res = await fetch(baseUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.status < 500 ? 'available' : 'unavailable';
    } catch {
      return 'unavailable';
    }
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
    config: ModelConfig,
  ): Promise<AdapterResult<ImageResult, ImageUsage>> {
    const apiKey = this.resolveAgnesApiKey(config);
    const endpoint = this.resolveEndpoint(config);
    const model = this.resolveModel(config);

    const size =
      params.width && params.height
        ? `${params.width}x${params.height}`
        : '1024x1024';

    const fullPrompt = sanitizeImagePrompt(
      [
        params.prompt,
        params.stylePreset,
        params.negativePrompt ? `Avoid: ${params.negativePrompt}` : '',
      ]
        .filter(Boolean)
        .join('. '),
    );

    const body: Record<string, unknown> = {
      model,
      prompt: fullPrompt,
      size,
      extra_body: {
        response_format: 'url',
      },
    };

    if (params.referenceImages && params.referenceImages.length > 0) {
      body.image = params.referenceImages;
    }

    const { result, latencyMs } = await this.measureLatency(async () => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error');
        console.error(
          `[AgnesImageAdapter] generation failed. prompt="${fullPrompt}" response="${text}"`,
        );
        throw new Error(
          `Agnes image generation failed (${res.status}): ${text}`,
        );
      }

      const json = (await res.json()) as AgnesImageResponse;
      const item = json.data?.[0];
      const url = item?.url ?? item?.b64_json;

      if (!url) {
        throw new Error(
          json.error?.message ??
            'Agnes image generation returned no image URL',
        );
      }

      return { url };
    });

    return {
      data: {
        url: result.url,
        seed: params.seed ?? 0,
      },
      usage: { credits: 1 },
      latencyMs,
      provider: this.provider,
      model,
    };
  }
}
