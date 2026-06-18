import { describe, expect, it } from 'vitest';
import {
  AdapterError,
  ErrorCode,
  isRetryableError,
  normalizeError,
} from '../../src/server/adapters/error.js';

describe('AdapterError', () => {
  it('stores code, message and retryable flag', () => {
    const err = new AdapterError(ErrorCode.TIMEOUT, 'request timed out', true);
    expect(err.code).toBe(ErrorCode.TIMEOUT);
    expect(err.message).toBe('request timed out');
    expect(err.retryable).toBe(true);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('normalizeError', () => {
  it('passes through AdapterError unchanged', () => {
    const original = new AdapterError(ErrorCode.RATE_LIMIT, 'too many requests', true);
    const normalized = normalizeError(original);
    expect(normalized).toBe(original);
  });

  it('classifies timeout errors as retryable', () => {
    const err = normalizeError(new Error('ETIMEDOUT'));
    expect(err.code).toBe(ErrorCode.TIMEOUT);
    expect(err.retryable).toBe(true);
  });

  it('classifies network errors as retryable', () => {
    const err = normalizeError(new Error('ECONNREFUSED'));
    expect(err.code).toBe(ErrorCode.NETWORK);
    expect(err.retryable).toBe(true);
  });

  it('classifies 5xx errors as retryable', () => {
    const err = normalizeError({ status: 502, message: 'bad gateway' });
    expect(err.code).toBe(ErrorCode.UPSTREAM_ERROR);
    expect(err.retryable).toBe(true);
  });

  it('classifies rate limit errors as retryable', () => {
    const err = normalizeError({ status: 429, message: 'rate limited' });
    expect(err.code).toBe(ErrorCode.RATE_LIMIT);
    expect(err.retryable).toBe(true);
  });

  it('classifies 4xx errors as non-retryable', () => {
    const err = normalizeError({ status: 400, message: 'bad request' });
    expect(err.code).toBe(ErrorCode.BAD_REQUEST);
    expect(err.retryable).toBe(false);
  });

  it('classifies auth errors as non-retryable', () => {
    const err = normalizeError({ status: 401, message: 'unauthorized' });
    expect(err.code).toBe(ErrorCode.AUTH_ERROR);
    expect(err.retryable).toBe(false);
  });

  it('classifies content policy errors as non-retryable', () => {
    const err = normalizeError(new Error('content_policy_violation'));
    expect(err.code).toBe(ErrorCode.CONTENT_POLICY);
    expect(err.retryable).toBe(false);
  });

  it('classifies unknown errors as retryable by default', () => {
    const err = normalizeError(new Error('something weird'));
    expect(err.code).toBe(ErrorCode.UNKNOWN);
    expect(err.retryable).toBe(true);
  });
});

describe('isRetryableError', () => {
  it('returns true for retryable adapter errors', () => {
    expect(isRetryableError(new AdapterError(ErrorCode.TIMEOUT, '', true))).toBe(true);
  });

  it('returns false for non-retryable adapter errors', () => {
    expect(isRetryableError(new AdapterError(ErrorCode.BAD_REQUEST, '', false))).toBe(false);
  });

  it('normalizes plain errors before checking', () => {
    expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    expect(isRetryableError(new Error('content_policy_violation'))).toBe(false);
  });
});
