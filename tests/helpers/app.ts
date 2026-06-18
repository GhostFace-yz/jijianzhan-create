import express from 'express';
import { ZodError } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AdapterPool } from '../../src/server/adapters/pool.js';
import { MockImageAdapter } from '../../src/server/adapters/providers/mock/mock-image-adapter.js';
import { createSnapshotService } from '../../src/server/services/snapshot/snapshot-service.js';
import { createChangePropagationService } from '../../src/server/services/snapshot/propagation.js';
import { createSnapshotRouter } from '../../src/server/routes/snapshots.js';
import { createProjectService } from '../../src/server/services/project/project-service.js';
import { createProjectRouter } from '../../src/server/routes/projects.js';
import { createCharacterService } from '../../src/server/services/character/character-service.js';
import { createCharacterRouter } from '../../src/server/routes/characters.js';
import { createSceneBibleService } from '../../src/server/services/scene-bible/scene-bible-service.js';
import { createLocationRouter } from '../../src/server/routes/locations.js';

export function createTestApp(prisma: PrismaClient) {
  const app = express();

  app.use(express.json());

  const adapterPool = new AdapterPool();
  adapterPool.registerImage(new MockImageAdapter());

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

  app.use('/api/v1/projects', createProjectRouter(projectService));
  app.use('/api/v1/projects/:projectId/characters', createCharacterRouter(characterService));
  app.use('/api/v1/projects/:projectId/locations', createLocationRouter(sceneBibleService));
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
