import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  code: number;
  message: string;
  data: T | null;
}

/**
 * Convert camelCase string to snake_case.
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Keys that should NOT be converted to snake_case.
 * These are widely-used OAuth/JWT field names that the frontend expects in camelCase.
 */
const PRESERVE_CAMEL_KEYS = new Set(['accessToken', 'refreshToken']);

/**
 * Recursively convert object keys from camelCase to snake_case.
 * Preserves keys listed in PRESERVE_CAMEL_KEYS at every level.
 */
function keysToSnakeCase(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => keysToSnakeCase(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = PRESERVE_CAMEL_KEYS.has(key) ? key : camelToSnake(key);
    result[newKey] = keysToSnakeCase(value);
  }
  return result;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        code: 200,
        message: 'success',
        data: data === null || data === undefined ? null : (keysToSnakeCase(data) as T),
      })),
    );
  }
}
