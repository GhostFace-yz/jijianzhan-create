import { Router } from 'express';
import { z } from 'zod';
import type { CharacterService } from '../services/character/types.js';

function routeParams(req: { params: Record<string, string> }): Record<string, string> {
  return req.params;
}

const roleTypeSchema = z.enum(['protagonist', 'supporting', 'antagonist']);
const characterStatusSchema = z.enum(['draft', 'confirmed']);

const characterFieldsSchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(100, '姓名最多 100 字'),
  role_type: roleTypeSchema,
  episode_range: z.string().max(50, '登场范围最多 50 字').optional().nullable(),
  appearance: z.string().max(2000, '外貌描述最多 2000 字').optional().nullable(),
  costume: z.string().max(2000, '服装描述最多 2000 字').optional().nullable(),
  expression: z.string().max(2000, '表情特征最多 2000 字').optional().nullable(),
  signature_action: z.string().max(500, '标志性动作最多 500 字').optional().nullable(),
  voice_description: z.string().max(500, '声线描述最多 500 字').optional().nullable(),
  status: characterStatusSchema.optional(),
});

const createCharacterBodySchema = characterFieldsSchema;
const updateCharacterBodySchema = characterFieldsSchema.partial();

const autoCreateBodySchema = z.object({
  characters: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        role_type: roleTypeSchema,
        episode_range: z.string().max(50).optional().nullable(),
        appearance: z.string().max(2000).optional().nullable(),
        costume: z.string().max(2000).optional().nullable(),
        expression: z.string().max(2000).optional().nullable(),
        signature_action: z.string().max(500).optional().nullable(),
        voice_description: z.string().max(500).optional().nullable(),
      })
    )
    .min(1, '至少提供一个角色'),
});

const generateViewsBodySchema = z.object({
  seed: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  style_preset: z.string().optional(),
});

const rollbackBodySchema = z.object({
  version_id: z.string().regex(/^v\d+$/, 'version_id 格式必须为 v1, v2...'),
});

export function createCharacterRouter(service: CharacterService): Router {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res, next) => {
    try {
      const result = await service.listCharacters(routeParams(req).projectId);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const body = createCharacterBodySchema.parse(req.body);
      const character = await service.createCharacter(routeParams(req).projectId, body);
      res.status(201).json({ data: character });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auto-create', async (req, res, next) => {
    try {
      const body = autoCreateBodySchema.parse(req.body);
      const characters = await service.autoCreateCharacters(routeParams(req).projectId, body.characters);
      res.status(201).json({ data: characters });
    } catch (error) {
      next(error);
    }
  });

  router.post('/sync-from-outline', async (req, res, next) => {
    try {
      const characters = await service.syncCharactersFromOutline(routeParams(req).projectId);
      res.status(201).json({ data: characters });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:charId', async (req, res, next) => {
    try {
      const character = await service.getCharacter(routeParams(req).projectId, routeParams(req).charId);
      if (!character) {
        res.status(404).json({ error: { message: 'Character not found' } });
        return;
      }
      res.json({ data: character });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:charId', async (req, res, next) => {
    try {
      const body = updateCharacterBodySchema.parse(req.body);
      const character = await service.updateCharacter(routeParams(req).projectId, routeParams(req).charId, body);
      res.json({ data: character });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:charId', async (req, res, next) => {
    try {
      await service.deleteCharacter(routeParams(req).projectId, routeParams(req).charId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post('/:charId/generate-views', async (req, res, next) => {
    try {
      const body = generateViewsBodySchema.parse(req.body);
      const character = await service.generateViews(routeParams(req).projectId, routeParams(req).charId, body);
      res.json({ data: character });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:charId/generate-views/:viewId/retry', async (req, res, next) => {
    try {
      const character = await service.retryView(routeParams(req).projectId, routeParams(req).charId, routeParams(req).viewId);
      res.json({ data: character });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:charId/confirm-views', async (req, res, next) => {
    try {
      const character = await service.confirmViews(routeParams(req).projectId, routeParams(req).charId);
      res.json({ data: character });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:charId/generate-refs', async (req, res, next) => {
    try {
      const character = await service.generateRefs(routeParams(req).projectId, routeParams(req).charId);
      res.json({ data: character });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:charId/rollback', async (req, res, next) => {
    try {
      const body = rollbackBodySchema.parse(req.body);
      const character = await service.rollbackCharacter(
        routeParams(req).projectId,
        routeParams(req).charId,
        body.version_id
      );
      res.json({ data: character });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
