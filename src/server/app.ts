import express from 'express';
import { ZodError } from 'zod';
import path from 'node:path';
import { createRedisConnection } from './lib/redis.js';
import { AdapterPool } from './adapters/pool.js';
import { DeepSeekTextAdapter } from './adapters/providers/deepseek/deepseek-text-adapter.js';
import { AgnesImageAdapter } from './adapters/providers/agnes/agnes-image-adapter.js';
import { MockImageAdapter } from './adapters/providers/mock/mock-image-adapter.js';
import { MockTextAdapter } from './adapters/providers/mock/mock-text-adapter.js';
import { MockMusicAdapter } from './adapters/providers/mock/mock-music-adapter.js';
import { MockTTSAdapter } from './adapters/providers/mock/mock-tts-adapter.js';
import { MockVideoAdapter } from './adapters/providers/mock/mock-video-adapter.js';
import { AgnesVideoAdapter } from './adapters/providers/agnes/agnes-video-adapter.js';
import { MockRenderAdapter } from './adapters/providers/mock/mock-render-adapter.js';
import { FFmpegRenderAdapter } from './adapters/providers/ffmpeg/ffmpeg-render-adapter.js';
import { LocalFileStorageService } from './services/storage/local-storage.js';
import { createRenderQueue } from './queues/render-queue.js';
import { createSnapshotService } from './services/snapshot/snapshot-service.js';
import { createChangePropagationService } from './services/snapshot/propagation.js';
import { createSnapshotRouter } from './routes/snapshots.js';
import { createProjectService } from './services/project/project-service.js';
import { createProjectRouter } from './routes/projects.js';
import { createCharacterService } from './services/character/character-service.js';
import { createCharacterRouter } from './routes/characters.js';
import { createSceneBibleService } from './services/scene-bible/scene-bible-service.js';
import { createLocationRouter } from './routes/locations.js';
import { createOutlineService } from './services/outline/outline-service.js';
import { createOutlineRouter } from './routes/outline.js';
import { createStoryboardService } from './services/storyboard/storyboard-service.js';
import { createStoryboardImageService } from './services/storyboard/storyboard-image-service.js';
import { createStoryboardRouter } from './routes/storyboard.js';
import { createScriptService } from './services/script/script-service.js';
import { createScriptRouter } from './routes/script.js';
import { createTtsService } from './services/storyboard/tts-service.js';
import { createTtsRouter } from './routes/tts.js';
import { createMusicService } from './services/music/music-service.js';
import { createMusicRouter } from './routes/music.js';
import { createVideoService } from './services/video/video-service.js';
import { createVideoRouter } from './routes/video.js';
import { createRenderService } from './services/render/render-service.js';
import { createRenderRouter } from './routes/render.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  const adapterPool = new AdapterPool();
  adapterPool.registerText(new MockTextAdapter());
  adapterPool.registerText(new DeepSeekTextAdapter());
  adapterPool.registerImage(new MockImageAdapter());
  adapterPool.registerImage(new AgnesImageAdapter());
  adapterPool.registerMusic(new MockMusicAdapter());
  adapterPool.registerTTS(new MockTTSAdapter());
  adapterPool.registerVideo(new MockVideoAdapter());
  adapterPool.registerVideo(new AgnesVideoAdapter());
  adapterPool.registerVideo(new MockVideoAdapter('mock-video-fallback'));
  adapterPool.registerRender(new MockRenderAdapter());

  const storage = new LocalFileStorageService({
    baseDir: process.env.RENDER_OUTPUT_DIR ?? './renders',
    baseUrl: process.env.RENDER_OUTPUT_URL ?? `http://localhost:${process.env.PORT ?? 3000}/media`,
  });

  // Serve persisted media (character images, uploaded videos, renders) over HTTP
  // so the frontend can load them. The URL path must match storage.save keys.
  app.use('/media', express.static(path.resolve(process.env.RENDER_OUTPUT_DIR ?? './renders')));
  adapterPool.registerRender(
    new FFmpegRenderAdapter({
      storage,
      ffmpegPath: process.env.FFMPEG_PATH,
    }),
  );

  // Redis / BullMQ 渲染队列仅在设置了 REDIS_URL 时启用；否则使用同步渲染降级路径
  const redisUrl = process.env.REDIS_URL;
  const renderQueue = redisUrl
    ? createRenderQueue(createRedisConnection(redisUrl))
    : undefined;
  if (!renderQueue) {
    console.log('REDIS_URL not set; render queue disabled, using synchronous fallback.');
  }

  const propagationService = createChangePropagationService();
  const snapshotService = createSnapshotService({
    onRollback: propagationService.markDownstreamForReview,
  });
  const projectService = createProjectService();
  const characterService = createCharacterService({
    snapshotService,
    adapterPool,
    storage,
  });
  const sceneBibleService = createSceneBibleService({
    snapshotService,
    adapterPool,
  });
  const outlineService = createOutlineService({
    snapshotService,
    adapterPool,
    sceneBibleService,
  });
  const storyboardService = createStoryboardService({
    snapshotService,
    adapterPool,
  });
  const storyboardImageService = createStoryboardImageService({
    adapterPool,
    storage,
  });
  const scriptService = createScriptService({
    snapshotService,
    adapterPool,
    maxRetries: 2,
  });
  const ttsService = createTtsService({
    storyboardService,
    characterService,
    adapterPool,
    snapshotService,
  });
  const musicService = createMusicService({
    storyboardService,
    adapterPool,
    snapshotService,
  });
  const videoService = createVideoService({
    storyboardService,
    characterService,
    sceneBibleService,
    adapterPool,
    snapshotService,
  });
  const renderService = createRenderService({
    storyboardService,
    musicService,
    adapterPool,
    snapshotService,
    queue: renderQueue,
  });

  app.use('/api/v1/projects', createProjectRouter(projectService));
  app.use('/api/v1/projects/:projectId/characters', createCharacterRouter(characterService));
  app.use('/api/v1/projects/:projectId/locations', createLocationRouter(sceneBibleService));
  app.use('/api/v1/projects/:projectId/outline', createOutlineRouter(outlineService, characterService));
  app.use(
    '/api/v1/projects/:projectId/episodes/:epId/storyboard',
    createStoryboardRouter(storyboardService, storyboardImageService)
  );
  app.use(
    '/api/v1/projects/:projectId/episodes/:epId/script',
    createScriptRouter(scriptService)
  );
  app.use(
    '/api/v1/projects/:projectId/episodes/:epId/audio/tts',
    createTtsRouter(ttsService)
  );
  app.use(
    '/api/v1/projects/:projectId/episodes/:epId/audio/music',
    createMusicRouter(musicService)
  );
  app.use(
    '/api/v1/projects/:projectId/episodes/:epId/video',
    createVideoRouter(videoService, storage)
  );
  app.use(
    '/api/v1/projects/:projectId/episodes/:epId/render',
    createRenderRouter(renderService)
  );
  app.use(
    '/api/v1/projects/:projectId/entities/:entityType/:entityId/versions',
    createSnapshotRouter(snapshotService)
  );

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation failed',
          details: err.issues.map((issue) => ({ path: issue.path, message: issue.message })),
        },
      });
      return;
    }

    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: { message } });
  });

  return app;
}
