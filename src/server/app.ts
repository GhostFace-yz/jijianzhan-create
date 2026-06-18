import express from 'express';
import { ZodError } from 'zod';
import { createSnapshotService } from './services/snapshot/snapshot-service.js';
import { createChangePropagationService } from './services/snapshot/propagation.js';
import { createSnapshotRouter } from './routes/snapshots.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  const propagationService = createChangePropagationService();
  const snapshotService = createSnapshotService({
    onRollback: propagationService.markDownstreamForReview,
  });
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
