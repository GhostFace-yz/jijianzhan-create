import type { HealthStatus, ModelConfig } from './types.js';

/**
 * Adapter 基类
 * 提供 provider 命名、健康检查默认实现和通用配置校验辅助方法
 */
export abstract class BaseAdapter {
  constructor(public readonly provider: string) {}

  /**
   * 默认健康检查实现
   * 子类可覆盖为轻量探针调用
   */
  async healthCheck(): Promise<HealthStatus> {
    return 'available';
  }

  /**
   * 校验配置中是否包含 API Key
   * 优先使用 config.apiKey，其次读取环境变量
   */
  protected resolveApiKey(config: ModelConfig): string {
    const envKey = process.env[`AI_${this.provider.toUpperCase().replace(/-/g, '_')}_API_KEY`];
    const key = config.apiKey ?? envKey;
    if (!key) {
      throw new Error(`API key not configured for provider: ${this.provider}`);
    }
    return key;
  }

  /**
   * 计算耗时
   */
  protected async measureLatency<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
    const start = performance.now();
    const result = await fn();
    const latencyMs = Math.round(performance.now() - start);
    return { result, latencyMs };
  }
}
