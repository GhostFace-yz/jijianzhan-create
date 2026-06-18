import { BaseAdapter } from '../../base-adapter.js';
import type {
  AITextAdapter,
  AdapterResult,
  ModelConfig,
  TextResult,
  TokenUsage,
} from '../../types.js';

/**
 * Mock 文本 Adapter
 * 用于测试和作为实现模板
 */
export class MockTextAdapter extends BaseAdapter implements AITextAdapter {
  constructor() {
    super('mock-text');
  }

  async generateText(
    prompt: string,
    systemPrompt: string | undefined,
    schema: import('zod').ZodSchema | undefined,
    config: ModelConfig
  ): Promise<AdapterResult<TextResult, TokenUsage>> {
    const { result, latencyMs } = await this.measureLatency(async () => {
      const content = systemPrompt
        ? `[system] ${systemPrompt}\n[user] ${prompt}`
        : `[user] ${prompt}`;

      if (schema) {
        return { content: JSON.stringify({ text: content, schema: true }) };
      }
      return { content };
    });

    return {
      data: result,
      usage: { inputTokens: prompt.length, outputTokens: result.content.length },
      latencyMs,
      provider: this.provider,
      model: config.model,
    };
  }
}
