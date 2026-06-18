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
  await testPrisma.character.deleteMany();
}

/**
 * 清空测试数据库中的场景卡片表
 */
export async function cleanLocations(): Promise<void> {
  await testPrisma.location.deleteMany();
}

/**
 * 清空测试数据库中的项目表
 */
export async function cleanProjects(): Promise<void> {
  await cleanLocations();
  await cleanCharacters();
  await testPrisma.project.deleteMany();
}

/**
 * 清空测试数据库中的快照与计数器表
 */
export async function cleanSnapshots(): Promise<void> {
  await testPrisma.downstreamReviewFlag.deleteMany();
  await testPrisma.versionSnapshot.deleteMany();
  await testPrisma.versionCounter.deleteMany();
}

/**
 * 断开测试数据库连接
 */
export async function disconnectTestDb(): Promise<void> {
  await testPrisma.$disconnect();
}
