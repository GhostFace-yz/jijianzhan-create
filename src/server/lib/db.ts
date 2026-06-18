import { PrismaClient } from '@prisma/client';

/**
 * Prisma 客户端单例
 * 通过环境变量 DATABASE_URL 连接数据库
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'test' ? [] : ['query', 'error', 'warn'],
});
