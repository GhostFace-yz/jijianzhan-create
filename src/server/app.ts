import express from 'express';
import { ZodError } from 'zod';
import { AdapterPool } from './adapters/pool.js';
import { MockImageAdapter } from './adapters/providers/mock/mock-image-adapter.js';
import { createSnapshotService } from './services/snapshot/snapshot-service.js';
import { createChangePropagationService } from './services/snapshot/propagation.js';
import { createSnapshotRouter } from './routes/snapshots.js';
import { createProjectService } from './services/project/project-service.js';
import { createProjectRouter } from './routes/projects.js';
import { createCharacterService } from './services/character/character-service.js';
import { createCharacterRouter } from './routes/characters.js';
import { createSceneBibleService } from './services/scene-bible/scene-bible-service.js';
import { createLocationRouter } from './routes/locations.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  const adapterPool = new AdapterPool();
  adapterPool.registerImage(new MockImageAdapter());

  const propagationService = createChangePropagationService();
  const snapshotService = createSnapshotService({
    onRollback: propagationService.markDownstreamForReview,
  });
  const projectService = createProjectService();
  const characterService = createCharacterService({
    snapshotService,
    adapterPool,
  });
  const sceneBibleService = createSceneBibleService({
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
