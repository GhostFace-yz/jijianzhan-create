import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerationType } from '@prisma/client';

export interface AgnesImageResult {
  url: string;
}

export interface AgnesVideoSubmitResult {
  taskId: string;
}

export interface AgnesVideoQueryResult {
  status: string;
  progress?: number;
  videoUrl?: string;
  errorMessage?: string;
}

export class AgnesApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AgnesApiError';
  }
}

@Injectable()
export class AgnesProvider {
  private readonly logger = new Logger(AgnesProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('AGNES_API_KEY');
    this.baseUrl =
      this.configService.get<string>('AGNES_BASE_URL') ??
      'https://apihub.agnes-ai.com/v1';
  }

  /**
   * Submit an image generation task (synchronous).
   * Returns the generated image URL directly.
   */
  async submitImageTask(params: {
    prompt: string;
    size?: string;
    referenceImages?: string[];
    [key: string]: unknown;
  }): Promise<AgnesImageResult> {
    const endpoint = `${this.baseUrl}/images/generations`;

    const extraBody: Record<string, unknown> = {};
    if (params.referenceImages?.length) {
      extraBody.image = params.referenceImages;
    }
    // Default to URL response format for direct access
    extraBody.response_format = 'url';

    const body: Record<string, unknown> = {
      model: 'agnes-image-2.1-flash',
      prompt: params.prompt,
      ...extraBody,
    };

    if (params.size) {
      body.size = params.size;
    }

    const response = await this.post(endpoint, body);

    // Image API returns synchronously with the result
    // Expected format: { data: [{ url: string }] } or { url: string }
    const data = response as Record<string, unknown>;

    let url: string | undefined;
    if (Array.isArray(data.data) && data.data.length > 0) {
      const first = data.data[0] as Record<string, unknown>;
      url = typeof first.url === 'string' ? first.url : undefined;
    } else if (typeof data.url === 'string') {
      url = data.url;
    }

    if (!url) {
      throw new AgnesApiError(
        'Invalid response from Agnes AI Image API: missing image URL',
      );
    }

    return { url };
  }

  /**
   * Submit a video generation task (asynchronous).
   * Returns a task ID for polling.
   */
  async submitVideoTask(params: {
    prompt: string;
    height?: number;
    width?: number;
    numFrames?: number;
    frameRate?: number;
    negativePrompt?: string;
    image?: string;
    [key: string]: unknown;
  }): Promise<AgnesVideoSubmitResult> {
    const endpoint = `${this.baseUrl}/videos`;

    const body: Record<string, unknown> = {
      model: 'agnes-video-v2.0',
      prompt: params.prompt,
    };

    // Passthrough video-specific parameters
    if (params.height !== undefined) body.height = params.height;
    if (params.width !== undefined) body.width = params.width;
    if (params.numFrames !== undefined) body.num_frames = params.numFrames;
    if (params.frameRate !== undefined) body.frame_rate = params.frameRate;
    if (params.negativePrompt !== undefined)
      body.negative_prompt = params.negativePrompt;
    if (params.image !== undefined) body.image = params.image;

    // Also passthrough any other params from the frontend
    const passthroughKeys = [
      'height',
      'width',
      'num_frames',
      'frame_rate',
      'negative_prompt',
      'image',
      'duration',
      'seed',
    ];
    for (const key of Object.keys(params)) {
      if (
        !['prompt', 'height', 'width', 'numFrames', 'frameRate', 'negativePrompt', 'image', 'type'].includes(key) &&
        passthroughKeys.includes(key) &&
        body[key] === undefined
      ) {
        body[key] = params[key];
      }
    }

    const response = await this.post(endpoint, body);

    const data = response as Record<string, unknown>;
    const taskId =
      typeof data.task_id === 'string'
        ? data.task_id
        : typeof data.id === 'string'
          ? data.id
          : undefined;

    if (!taskId) {
      throw new AgnesApiError(
        'Invalid response from Agnes AI Video API: missing task ID',
      );
    }

    return { taskId };
  }

  /**
   * Query the status of a video generation task.
   */
  async queryVideoTask(taskId: string): Promise<AgnesVideoQueryResult> {
    const endpoint = `${this.baseUrl}/videos/${taskId}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Agnes Video Query error: ${response.status} ${errorText}`,
        );
        throw new AgnesApiError(
          this.mapErrorMessage(errorText, response.status),
          response.status,
        );
      }

      const data = (await response.json()) as Record<string, unknown>;

      return {
        status: String(data.status ?? 'unknown'),
        progress:
          typeof data.progress === 'number' ? data.progress : undefined,
        videoUrl:
          typeof data.video_url === 'string'
            ? data.video_url
            : typeof data.url === 'string'
              ? data.url
              : undefined,
        errorMessage:
          typeof data.error_message === 'string'
            ? data.error_message
            : undefined,
      };
    } catch (err: any) {
      if (err instanceof AgnesApiError) {
        throw err;
      }
      this.logger.error(
        `Agnes Video Query request failed: ${err.message}`,
        err.stack,
      );
      throw new AgnesApiError('Failed to query Agnes AI video task');
    }
  }

  private async post(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Agnes API error: ${response.status} ${errorText}`,
        );
        throw new AgnesApiError(
          this.mapErrorMessage(errorText, response.status),
          response.status,
        );
      }

      return response.json();
    } catch (err: any) {
      if (err instanceof AgnesApiError) {
        throw err;
      }
      this.logger.error(
        `Agnes API request failed: ${err.message}`,
        err.stack,
      );
      throw new AgnesApiError('Failed to connect to Agnes AI service');
    }
  }

  private mapErrorMessage(message: string, status?: number): string {
    if (status === 401) return 'Agnes AI 认证失败，请检查 API Key 配置';
    if (status === 429) return 'Agnes AI 请求过于频繁，请稍后再试';
    if (status === 500) return 'Agnes AI 服务内部错误，请稍后再试';
    if (status === 503) return 'Agnes AI 服务暂不可用，请稍后再试';
    return `Agnes AI 调用失败: ${message}`;
  }
}
