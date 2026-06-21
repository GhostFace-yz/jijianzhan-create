import OpenAI from 'openai';
import { BaseAdapter } from '../../base-adapter.js';
import type {
  AITextAdapter,
  AdapterResult,
  ModelConfig,
  TextResult,
  TokenUsage,
  HealthStatus,
} from '../../types.js';

/**
 * DeepSeek 文本生成 Adapter
 *
 * DeepSeek 提供 OpenAI 兼容的 API，因此复用 openai SDK。
 * 支持普通文本生成和 JSON 模式（传入 zod schema 时启用）。
 */
export class DeepSeekTextAdapter extends BaseAdapter implements AITextAdapter {
  constructor() {
    super('deepseek');
  }

  private createClient(config: ModelConfig): OpenAI {
    const apiKey = config.apiKey ?? process.env.DEEP_SEEK_API_KEY;
    const baseURL = config.baseUrl ?? process.env.DEEP_SEEK_BASE_URL;

    if (!apiKey) {
      throw new Error(
        'DeepSeek API key not configured. Set DEEP_SEEK_API_KEY or pass config.apiKey.',
      );
    }

    return new OpenAI({ apiKey, baseURL });
  }

  private resolveModel(config: ModelConfig): string {
    return config.model ?? process.env.DEEP_SEEK_MODEL ?? 'deepseek-chat';
  }

  async healthCheck(): Promise<HealthStatus> {
    const apiKey = process.env.DEEP_SEEK_API_KEY;
    const baseURL = process.env.DEEP_SEEK_BASE_URL;

    if (!apiKey || !baseURL) {
      return 'unavailable';
    }

    try {
      const client = new OpenAI({ apiKey, baseURL });
      // 轻量探针：列出模型，DeepSeek 支持 /models
      await client.models.list();
      return 'available';
    } catch {
      return 'unavailable';
    }
  }

  async generateText(
    prompt: string,
    systemPrompt: string | undefined,
    schema: import('zod').ZodSchema | undefined,
    config: ModelConfig,
  ): Promise<AdapterResult<TextResult, TokenUsage>> {
    const client = this.createClient(config);
    const model = this.resolveModel(config);
    const useJsonMode = schema !== undefined;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // 当启用 JSON 模式时，确保 user prompt 明确包含 JSON 要求
    const finalPrompt = useJsonMode
      ? `${prompt}\n\nYou must respond with valid JSON only.`
      : prompt;

    messages.push({ role: 'user', content: finalPrompt });

    const { result, latencyMs } = await this.measureLatency(async () => {
      const response = await client.chat.completions.create({
        model,
        messages,
        response_format: useJsonMode ? { type: 'json_object' } : undefined,
        temperature: (config.extraParams?.temperature as number | undefined) ?? 0.7,
        max_tokens: (config.extraParams?.max_tokens as number | undefined) ?? 4096,
      });

      const content = response.choices[0]?.message?.content ?? '';
      const usage = response.usage;

      return {
        content,
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
      };
    });

    return {
      data: { content: result.content },
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
      latencyMs,
      provider: this.provider,
      model,
    };
  }
}
