import { Router } from 'express';
import { z } from 'zod';
import type { SceneBibleService } from '../services/scene-bible/types.js';

function routeParams(req: { params: Record<string, string> }): Record<string, string> {
  return req.params;
}

const locationStatusSchema = z.enum(['draft', 'confirmed']);

const locationFieldsSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100, '名称最多 100 字'),
  description: z.string().max(2000, '描述最多 2000 字').optional().nullable(),
  frequency: z.string().max(50, '出现频率最多 50 字').optional().nullable(),
  space_type: z.string().max(50, '空间类型最多 50 字').optional().nullable(),
  style: z.string().max(200, '风格最多 200 字').optional().nullable(),
  color_tone: z.string().max(100, '色调最多 100 字').optional().nullable(),
  lighting_type: z.string().max(100, '光线类型最多 100 字').optional().nullable(),
  key_props: z.array(z.string()).optional(),
  status: locationStatusSchema.optional(),
});

const updateLocationBodySchema = locationFieldsSchema.partial();

const generateBaseBodySchema = z.object({
  seed: z.number().int().optional(),
});

const confirmBaseBodySchema = z.object({
  candidate: z.object({
    url: z.string().url(),
    seed: z.number().int(),
    prompt: z.string(),
  }),
});

const generateVariantBodySchema = z.object({
  time_of_day: z.string().min(1, '时间段不能为空'),
  weather: z.string().min(1, '天气不能为空'),
});

const confirmVariantBodySchema = z.object({
  time_of_day: z.string().min(1, '时间段不能为空'),
  weather: z.string().min(1, '天气不能为空'),
  variant: z.object({
    url: z.string().url(),
    seed: z.number().int(),
    prompt: z.string(),
  }),
});

const rollbackBodySchema = z.object({
  version_id: z.string().regex(/^v\d+$/, 'version_id 格式必须为 v1, v2...'),
});

export function createLocationRouter(service: SceneBibleService): Router {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res, next) => {
    try {
      const result = await service.listScenes(routeParams(req).projectId);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:locId', async (req, res, next) => {
    try {
      const body = updateLocationBodySchema.parse(req.body);
      const location = await service.updateScene(
        routeParams(req).projectId,
        routeParams(req).locId,
        body
      );
      res.json({ data: location });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:locId/generate-base', async (req, res, next) => {
    try {
      const body = generateBaseBodySchema.parse(req.body);
      const candidates = await service.generateBaseCandidates(
        routeParams(req).projectId,
        routeParams(req).locId,
        body
      );
      res.json({ data: candidates });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:locId/confirm-base', async (req, res, next) => {
    try {
      const body = confirmBaseBodySchema.parse(req.body);
      const location = await service.confirmBase(
        routeParams(req).projectId,
        routeParams(req).locId,
        body.candidate
      );
      res.json({ data: location });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:locId/generate-variant', async (req, res, next) => {
    try {
      const body = generateVariantBodySchema.parse(req.body);
      const variant = await service.generateVariant(
        routeParams(req).projectId,
        routeParams(req).locId,
        body
      );
      res.json({ data: variant });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:locId/confirm-variant', async (req, res, next) => {
    try {
      const body = confirmVariantBodySchema.parse(req.body);
      const location = await service.confirmVariant(
        routeParams(req).projectId,
        routeParams(req).locId,
        body
      );
      res.json({ data: location });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:locId/versions', async (req, res, next) => {
    try {
      const history = await service.getSceneHistory(
        routeParams(req).projectId,
        routeParams(req).locId
      );
      res.json({ data: history });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:locId/rollback', async (req, res, next) => {
    try {
      const body = rollbackBodySchema.parse(req.body);
      const location = await service.rollbackScene(
        routeParams(req).projectId,
        routeParams(req).locId,
        body.version_id
      );
      res.json({ data: location });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
