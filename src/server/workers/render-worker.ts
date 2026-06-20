import { Worker } from 'bullmq';
import { createRedisConnection } from '../lib/redis.js';
import { prisma } from '../lib/db.js';
import { createRenderQueue, RENDER_QUEUE_NAME } from '../queues/render-queue.js';
import { createRenderService } from '../services/render/render-service.js';
import { createStoryboardService } from '../services/storyboard/storyboard-service.js';
import { createCharacterService } from '../services/character/character-service.js';
import { createSceneBibleService } from '../services/scene-bible/scene-bible-service.js';
import { createMusicService } from '../services/music/music-service.js';
import { createSnapshotService } from '../services/snapshot/snapshot-service.js';
import { createChangePropagationService } from '../services/snapshot/propagation.js';
import { createDefaultAdapterPool } from '../adapters/index.js';
import { LocalFileStorageService } from '../services/storage/local-storage.js';
import { FFmpegRenderAdapter } from '../adapters/providers/ffmpeg/ffmpeg-render-adapter.js';

/**
 * 渲染 Worker 入口
 *
 * 独立进程运行，从 BullMQ 消费渲染任务并调用 FFmpeg 执行真实渲染。
 */
async function main() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = createRedisConnection(redisUrl);

  const adapterPool = createDefaultAdapterPool();

  // 注册真实 FFmpeg Adapter（mock-render 已在默认池中注册，作为降级）
  const storage = new LocalFileStorageService({
    baseDir: process.env.RENDER_OUTPUT_DIR ?? './renders',
    baseUrl: process.env.RENDER_OUTPUT_URL ?? 'file://',
  });
  adapterPool.registerRender(
    new FFmpegRenderAdapter({
      storage,
      ffmpegPath: process.env.FFMPEG_PATH,
    }),
  );

  const propagationService = createChangePropagationService();
  const snapshotService = createSnapshotService({
    onRollback: propagationService.markDownstreamForReview,
  });
  const characterService = createCharacterService({ snapshotService, adapterPool });
  const sceneBibleService = createSceneBibleService({ snapshotService, adapterPool });
  const storyboardService = createStoryboardService({ snapshotService, adapterPool });
  const musicService = createMusicService({ storyboardService, adapterPool, snapshotService });

  const renderService = createRenderService({
    storyboardService,
    musicService,
    adapterPool,
    snapshotService,
  });

  const queue = createRenderQueue(connection);
  const worker = new Worker(
    RENDER_QUEUE_NAME,
    async (job) => {
      const { projectId, episodeId, options, plan } = job.data as {
        projectId: string;
        episodeId: string;
        options: Record<string, unknown>;
        plan: unknown;
      };
      await renderService.processRenderJob(projectId, episodeId, options as never, plan as never, {
        onProgress: (progress) => job.updateProgress(progress),
      });
    },
    {
      connection,
      concurrency: Number(process.env.RENDER_CONCURRENCY ?? '1'),
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`Render job ${job?.id} failed:`, err);
  });

  worker.on('completed', (job) => {
    console.log(`Render job ${job.id} completed`);
  });

  console.log(`Render worker started, consuming from ${RENDER_QUEUE_NAME}`);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await worker.close();
    await queue.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Render worker failed to start:', err);
  process.exit(1);
});
