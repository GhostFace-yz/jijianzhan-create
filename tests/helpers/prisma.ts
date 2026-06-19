import { PrismaClient } from '@prisma/client';

/**
 * 测试用 Prisma 客户端
 * 通过环境变量 DATABASE_URL 指向独立的测试数据库
 */
export const testPrisma = new PrismaClient({
  log: [],
});

/**
 * 清空测试数据库中的角色表
 */
export async function cleanCharacters(): Promise<void> {
  await testPrisma.characters.deleteMany();
}

/**
 * 清空测试数据库中的场景卡片表
 */
export async function cleanLocations(): Promise<void> {
  await testPrisma.locations.deleteMany();
}

/**
 * 清空测试数据库中的项目表
 */
export async function cleanProjects(): Promise<void> {
  await testPrisma.locations.deleteMany();
  await testPrisma.characters.deleteMany();
  await testPrisma.projects.deleteMany();
}

/**
 * 清空测试数据库中的快照与计数器表
 */
export async function cleanSnapshots(): Promise<void> {
  await testPrisma.downstream_review_flags.deleteMany();
  await testPrisma.version_snapshots.deleteMany();
  await testPrisma.version_counters.deleteMany();
}

/**
 * 断开测试数据库连接
 */
export async function disconnectTestDb(): Promise<void> {
  await testPrisma.$disconnect();
}
