import { Redis } from 'ioredis';

export function createRedisConnection(url?: string): Redis {
  return new Redis(url ?? process.env.REDIS_URL ?? 'redis://localhost:6379');
}
