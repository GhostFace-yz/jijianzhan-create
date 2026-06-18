import express from 'express';
import { ZodError } from 'zod';
import { PrismaClient } from '@prisma/client';
import { createSnapshotService } from '../../src/server/services/snapshot/snapshot-service.js';
import { createChangePropagationService } from '../../src/server/services/snapshot/propagation.js';
import { createSnapshotRouter } from '../../src/server/routes/snapshots.js';

export function createTestApp(prisma: PrismaClient) {
  const app = express();

  app.use(express.json());

  const propagationService = createChangePropagationService({ prisma });
  const snapshotService = createSnapshotService({
    prisma,
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
