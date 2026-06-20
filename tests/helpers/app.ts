import express from 'express';
import { ZodError } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AdapterPool } from '../../src/server/adapters/pool.js';
import { MockImageAdapter } from '../../src/server/adapters/providers/mock/mock-image-adapter.js';
import { MockTextAdapter } from '../../src/server/adapters/providers/mock/mock-text-adapter.js';
import { MockMusicAdapter } from '../../src/server/adapters/providers/mock/mock-music-adapter.js';
import { MockRenderAdapter } from '../../src/server/adapters/providers/mock/mock-render-adapter.js';
import { MockTTSAdapter } from '../../src/server/adapters/providers/mock/mock-tts-adapter.js';
import { MockVideoAdapter } from '../../src/server/adapters/providers/mock/mock-video-adapter.js';

import { createSnapshotService } from '../../src/server/services/snapshot/snapshot-service.js';
import { createChangePropagationService } from '../../src/server/services/snapshot/propagation.js';
import { createSnapshotRouter } from '../../src/server/routes/snapshots.js';
import { createProjectService } from '../../src/server/services/project/project-service.js';
import { createProjectRouter } from '../../src/server/routes/projects.js';
import { createCharacterService } from '../../src/server/services/character/character-service.js';
import { createCharacterRouter } from '../../src/server/routes/characters.js';
import { createSceneBibleService } from '../../src/server/services/scene-bible/scene-bible-service.js';
import { createLocationRouter } from '../../src/server/routes/locations.js';
import { createOutlineService } from '../../src/server/services/outline/outline-service.js';
import { createOutlineRouter } from '../../src/server/routes/outline.js';
import { createStoryboardService } from '../../src/server/services/storyboard/storyboard-service.js';
import { createStoryboardRouter } from '../../src/server/routes/storyboard.js';
import { createTtsService } from '../../src/server/services/storyboard/tts-service.js';
import { createTtsRouter } from '../../src/server/routes/tts.js';
import { createMusicService } from '../../src/server/services/music/music-service.js';
import { createMusicRouter } from '../../src/server/routes/music.js';
import { createVideoService } from '../../src/server/services/video/video-service.js';
import { createVideoRouter } from '../../src/server/routes/video.js';
import { createRenderService } from '../../src/server/services/render/render-service.js';
import { createRenderRouter } from '../../src/server/routes/render.js';
import { LocalFileStorageService } from '../../src/server/services/storage/local-storage.js';

export function createTestApp(prisma: PrismaClient) {
  const app = express();

  app.use(express.json());

  const adapterPool = new AdapterPool();
  adapterPool.registerImage(new MockImageAdapter());
  adapterPool.registerText(new MockTextAdapter());
  adapterPool.registerMusic(new MockMusicAdapter());
  adapterPool.registerTTS(new MockTTSAdapter());
  adapterPool.registerVideo(new MockVideoAdapter());
  adapterPool.registerVideo(new MockVideoAdapter('mock-video-fallback'));
  adapterPool.registerRender(new MockRenderAdapter());
  adapterPool.registerRender(new MockRenderAdapter('mock-render-fallback'));

  const storage = new LocalFileStorageService({
    baseDir: process.env.RENDER_OUTPUT_DIR ?? './renders',
    baseUrl: process.env.RENDER_OUTPUT_URL ?? 'file://',
  });

  const propagationService = createChangePropagationService({ prisma });
  const snapshotService = createSnapshotService({
    prisma,
    onRollback: propagationService.markDownstreamForReview,
  });
  const projectService = createProjectService({ prisma });
  const characterService = createCharacterService({
    prisma,
    snapshotService,
    adapterPool,
  });
  const sceneBibleService = createSceneBibleService({
    prisma,
    snapshotService,
    adapterPool,
  });
  const outlineService = createOutlineService({
    prisma,
    snapshotService,
    adapterPool,
  });
  const storyboardService = createStoryboardService({
    prisma,
    snapshotService,
    adapterPool,
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
    prisma,
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
  });

  app.use('/api/v1/projects', createProjectRouter(projectService));
  app.use('/api/v1/projects/:projectId/characters', createCharacterRouter(characterService));
  app.use('/api/v1/projects/:projectId/locations', createLocationRouter(sceneBibleService));
  app.use('/api/v1/projects/:projectId/outline', createOutlineRouter(outlineService));
  app.use(
    '/api/v1/projects/:projectId/episodes/:epId/storyboard',
    createStoryboardRouter(storyboardService)
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
