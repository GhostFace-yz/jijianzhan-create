import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class KimiApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'KimiApiError';
  }
}

@Injectable()
export class KimiProvider {
  private readonly logger = new Logger(KimiProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('KIMI_API_KEY');
    const baseURL = this.configService.get<string>('KIMI_BASE_URL');
    this.model = this.configService.get<string>('KIMI_MODEL') ?? 'moonshot-v1-8k';

    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: 60_000,
      maxRetries: 2,
    });
  }

  async *streamChat(
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): AsyncGenerator<string, void, unknown> {
    try {
      const stream = await this.client.chat.completions.create(
        {
          model: this.model,
          messages,
          stream: true,
          temperature: 0.7,
        },
        { signal },
      );

      for await (const part of stream) {
        if (signal?.aborted) {
          break;
        }

        const delta = part.choices[0]?.delta?.content;
        if (delta) {
          yield delta;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) {
        this.logger.log('Kimi stream aborted by client');
        return;
      }

      const status = err.status ?? err.statusCode;
      const code = err.code ?? err.type;
      this.logger.error(
        `Kimi API error: ${err.message}`,
        err.stack,
      );

      throw new KimiApiError(
        this.mapErrorMessage(err.message, status),
        status,
        code,
      );
    }
  }

  private mapErrorMessage(message: string, status?: number): string {
    if (status === 401) return 'AI 服务认证失败，请检查 API Key 配置';
    if (status === 429) return 'AI 服务请求过于频繁，请稍后再试';
    if (status === 500) return 'AI 服务内部错误，请稍后再试';
    if (status === 503) return 'AI 服务暂不可用，请稍后再试';
    return 'AI 服务调用失败，请稍后再试';
  }
}
