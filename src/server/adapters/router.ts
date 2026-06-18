import { isRetryableError, normalizeError, type AdapterError } from './error.js';
import type { AICallLogger } from './logger.js';
import type { AdapterPool } from './pool.js';
import type { AdapterExecutor, ModelBinding, TaskType } from './types.js';

/**
 * Fallback 路由器
 * 按 ModelBinding 的主备链执行，遇到可用性错误时自动切换
 */
export class FallbackRouter {
  constructor(
    private readonly pool: AdapterPool,
    private readonly logger: AICallLogger
  ) {}

  /**
   * 执行 Adapter 调用，失败时按 fallback 链切换
   */
  async execute<T extends TaskType, R>(
    binding: ModelBinding<T>,
    executor: AdapterExecutor<T, R>
  ): Promise<R> {
    const configs = [binding.primary, ...binding.fallbacks];
    let lastError: AdapterError | undefined;

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const adapter = this.pool.route(binding.taskType, config.provider);

      // 如果已知 Adapter 不可用，直接跳过并记录
      const health = this.pool.getHealthStatus(binding.taskType, config.provider);
      if (health === 'unavailable') {
        lastError = normalizeError(new Error(`Adapter ${config.provider} is unavailable`));
        this.logger.logFallback({
          taskType: binding.taskType,
          failedProvider: config.provider,
          fallbackProvider: configs[i + 1]?.provider ?? 'none',
          errorCode: lastError.code,
        });
        continue;
      }

      try {
        return await executor(adapter, config);
      } catch (err) {
        lastError = normalizeError(err);
        if (!lastError.retryable) {
          break;
        }

        const nextConfig = configs[i + 1];
        if (nextConfig) {
          this.logger.logFallback({
            taskType: binding.taskType,
            failedProvider: config.provider,
            fallbackProvider: nextConfig.provider,
            errorCode: lastError.code,
          });
        }
      }
    }

    throw lastError ?? new Error('No adapters available in binding');
  }
}
