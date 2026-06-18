import type { ErrorCode } from './error.js';
import type { TaskType, TokenUsage, ImageUsage, VideoUsage, TTSUsage, MusicUsage } from './types.js';

/**
 * 用量联合类型
 */
export type Usage = TokenUsage | ImageUsage | VideoUsage | TTSUsage | MusicUsage;

/**
 * 调用日志条目
 */
export interface AICallLogEntry {
  taskType: TaskType;
  provider: string;
  model: string;
  status: 'success' | 'error' | 'fallback';
  latencyMs: number;
  usage: Usage;
  projectId?: string;
  episodeId?: string;
  nodeId?: string;
  errorCode?: ErrorCode;
  metadata?: Record<string, unknown>;
}

/**
 * Fallback 日志条目
 */
export interface AIFallbackLogEntry {
  taskType: TaskType;
  failedProvider: string;
  fallbackProvider: string;
  errorCode: ErrorCode;
  model?: string;
  projectId?: string;
  episodeId?: string;
  nodeId?: string;
}

/**
 * AI 调用日志接口
 * 未来可替换为写入数据库或消息队列的实现
 */
export interface AICallLogger {
  logCall(entry: AICallLogEntry): void;
  logFallback(entry: AIFallbackLogEntry): void;
}

/**
 * 脱敏：移除 metadata 中的敏感字段
 */
function sanitizeMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const clone = { ...metadata };
  delete clone.apiKey;
  delete clone.api_key;
  delete clone.token;
  delete clone.secret;
  return clone;
}

/**
 * 默认控制台日志实现
 */
export class DefaultAICallLogger implements AICallLogger {
  logCall(entry: AICallLogEntry): void {
    const safeEntry = {
      ...entry,
      metadata: sanitizeMetadata(entry.metadata),
    };

    const line = `[AI_CALL] ${safeEntry.status} ${safeEntry.taskType} ${safeEntry.provider}/${safeEntry.model} ${safeEntry.latencyMs}ms`;

    if (safeEntry.status === 'error') {
      console.error(line, safeEntry);
    } else {
      console.log(line, safeEntry);
    }
  }

  logFallback(entry: AIFallbackLogEntry): void {
    const line = `[AI_FALLBACK] ${entry.taskType} ${entry.failedProvider} -> ${entry.fallbackProvider} (${entry.errorCode})`;
    console.warn(line, entry);
  }
}

/**
 * 空日志实现，用于测试或禁用日志场景
 */
export class NoopLogger implements AICallLogger {
  logCall(_entry: AICallLogEntry): void {
    // no-op
  }

  logFallback(_entry: AIFallbackLogEntry): void {
    // no-op
  }
}
