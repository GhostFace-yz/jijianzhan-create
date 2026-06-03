import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerationType } from '@prisma/client';

export interface AgnesSubmitResult {
  providerTaskId: string;
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
      'https://api.agnes-ai.com/v1';
  }

  async submitTask(params: {
    type: GenerationType;
    prompt?: string;
    referenceImages?: string[];
    [key: string]: unknown;
  }): Promise<AgnesSubmitResult> {
    const endpoint =
      params.type === GenerationType.IMAGE
        ? `${this.baseUrl}/images/generations`
        : `${this.baseUrl}/videos/generations`;

    const body = {
      prompt: params.prompt ?? '',
      ...(params.referenceImages?.length
        ? { reference_images: params.referenceImages }
        : {}),
      ...params,
    };

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

      const data = (await response.json()) as {
        id?: string;
        task_id?: string;
        provider_task_id?: string;
      };

      const providerTaskId =
        data.provider_task_id ?? data.task_id ?? data.id;

      if (!providerTaskId) {
        throw new AgnesApiError(
          'Invalid response from Agnes AI: missing task ID',
        );
      }

      return { providerTaskId };
    } catch (err: any) {
      if (err instanceof AgnesApiError) {
        throw err;
      }
      this.logger.error(`Agnes API request failed: ${err.message}`, err.stack);
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
