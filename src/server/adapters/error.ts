/**
 * 统一错误码
 */
export enum ErrorCode {
  TIMEOUT = 'AI_TIMEOUT',
  NETWORK = 'AI_NETWORK_ERROR',
  UPSTREAM_ERROR = 'AI_UPSTREAM_ERROR',
  RATE_LIMIT = 'AI_RATE_LIMIT',
  BAD_REQUEST = 'AI_BAD_REQUEST',
  AUTH_ERROR = 'AI_AUTH_ERROR',
  CONTENT_POLICY = 'AI_CONTENT_POLICY',
  VALIDATION = 'AI_VALIDATION_ERROR',
  UNKNOWN = 'AI_UNKNOWN_ERROR',
}

/**
 * Adapter 层统一错误
 */
export class AdapterError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

interface HttpLikeError {
  status?: number;
  message?: string;
}

function isHttpLikeError(err: unknown): err is HttpLikeError {
  return typeof err === 'object' && err !== null && ('status' in err || 'message' in err);
}

/**
 * 将任意错误归一化为 AdapterError
 * 仅可用性错误（超时、网络、5xx、限流）标记为 retryable
 */
export function normalizeError(err: unknown): AdapterError {
  if (err instanceof AdapterError) {
    return err;
  }

  const message = extractMessage(err);
  const lowerMessage = message.toLowerCase();

  // 超时类
  if (
    lowerMessage.includes('etimedout') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('econnreset')
  ) {
    return new AdapterError(ErrorCode.TIMEOUT, message, true);
  }

  // 网络类
  if (lowerMessage.includes('econnrefused') || lowerMessage.includes('enotfound')) {
    return new AdapterError(ErrorCode.NETWORK, message, true);
  }

  // HTTP 状态码
  if (isHttpLikeError(err)) {
    const status = err.status;
    if (status === 429) {
      return new AdapterError(ErrorCode.RATE_LIMIT, message, true);
    }
    if (status && status >= 500 && status < 600) {
      return new AdapterError(ErrorCode.UPSTREAM_ERROR, message, true);
    }
    if (status === 401 || status === 403) {
      return new AdapterError(ErrorCode.AUTH_ERROR, message, false);
    }
    if (status && status >= 400 && status < 500) {
      return new AdapterError(ErrorCode.BAD_REQUEST, message, false);
    }
  }

  // 内容政策 / 安全类
  if (lowerMessage.includes('content_policy') || lowerMessage.includes('content policy')) {
    return new AdapterError(ErrorCode.CONTENT_POLICY, message, false);
  }

  // 参数校验类
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
    return new AdapterError(ErrorCode.VALIDATION, message, false);
  }

  // 未知错误默认按可用性问题处理，允许 fallback
  return new AdapterError(ErrorCode.UNKNOWN, message, true);
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (isHttpLikeError(err) && err.message) {
    return err.message;
  }
  return String(err);
}

/**
 * 判断错误是否可触发 fallback
 */
export function isRetryableError(err: unknown): boolean {
  return normalizeError(err).retryable;
}
