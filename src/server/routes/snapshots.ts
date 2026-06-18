import { Router } from 'express';
import { z } from 'zod';
import type { EntityRef, SnapshotService } from '../services/snapshot/types.js';

const entityTypeSchema = z.enum([
  'project',
  'outline',
  'character',
  'scene',
  'script',
  'node',
  'generation_result',
  'location',
]);

function entityFromParams(params: Record<string, string>): EntityRef {
  return {
    projectId: params.projectId,
    entityType: entityTypeSchema.parse(params.entityType),
    entityId: params.entityId,
  };
}

const versionIdSchema = z.string().regex(/^v\d+$/, 'version_id must be like v1, v2...');

const createSnapshotBodySchema = z.object({
  source: z.enum(['ai_generated', 'user_edited', 'ai_regenerated', 'locked']),
  content: z.record(z.unknown()),
  edited_by: z.string().optional(),
  ai_model: z
    .object({
      provider: z.string(),
      model: z.string(),
    })
    .optional(),
  prompt_override: z.string().optional(),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const compareQuerySchema = z.object({
  from: versionIdSchema,
  to: versionIdSchema,
});

export function createSnapshotRouter(service: SnapshotService): Router {
  const router = Router({ mergeParams: true });

  router.post('/', async (req, res, next) => {
    try {
      const entity = entityFromParams(req.params as Record<string, string>);
      const body = createSnapshotBodySchema.parse(req.body);

      const snapshot = await service.createSnapshot({
        entity,
        source: body.source,
        content: body.content,
        editedBy: body.edited_by,
        aiModel: body.ai_model,
        promptOverride: body.prompt_override,
      });

      res.status(201).json({ data: snapshot });
    } catch (error) {
      next(error);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const entity = entityFromParams(req.params as Record<string, string>);
      const query = historyQuerySchema.parse(req.query);

      const history = await service.getHistory(entity, {
        limit: query.limit,
        offset: query.offset,
      });

      res.json({ data: history });
    } catch (error) {
      next(error);
    }
  });

  router.get('/compare', async (req, res, next) => {
    try {
      const entity = entityFromParams(req.params as Record<string, string>);
      const query = compareQuerySchema.parse(req.query);

      const result = await service.compareSnapshots(entity, query.from, query.to);

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:versionId', async (req, res, next) => {
    try {
      const entity = entityFromParams(req.params as Record<string, string>);
      const versionId = versionIdSchema.parse(req.params.versionId);

      const snapshot = await service.getSnapshot(entity, versionId);

      if (!snapshot) {
        res.status(404).json({ error: { message: 'Version not found' } });
        return;
      }

      res.json({ data: snapshot });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:versionId/rollback', async (req, res, next) => {
    try {
      const entity = entityFromParams(req.params as Record<string, string>);
      const versionId = versionIdSchema.parse(req.params.versionId);
      const editedBy =
        typeof req.body?.edited_by === 'string' ? req.body.edited_by : undefined;

      const snapshot = await service.rollback({ entity, versionId, editedBy });

      res.status(201).json({ data: snapshot });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
