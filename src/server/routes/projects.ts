import { Router } from 'express';
import { z } from 'zod';
import type { ProjectService } from '../services/project/types.js';

const projectStatusSchema = z.enum([
  'draft',
  'outlining',
  'asset_prep',
  'producing',
  'completed',
]);

const projectGenreSchema = z.enum([
  'urban_romance',
  'ancient_costume',
  'suspense',
  'comedy',
  'sci_fi',
  'other',
]);

const projectDurationGoalSchema = z.enum(['3min', '5min', '10min']);

const projectStyleTagSchema = z.enum([
  'realistic',
  'comic',
  'cyberpunk',
  'chinese_style',
  'fresh',
  'dark',
]);

const projectMetaSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(50, '标题最多 50 字'),
  description: z.string().min(1, '创意描述不能为空').max(1000, '创意描述最多 1000 字'),
  genre: projectGenreSchema,
  target_episodes: z.coerce.number().int().min(1).max(100).optional().nullable(),
  duration_goal: projectDurationGoalSchema.optional().nullable(),
  style_tags: z.array(projectStyleTagSchema).default([]),
  notes: z.string().max(2000, '创作备注最多 2000 字').optional().nullable(),
});

const createProjectBodySchema = z.object({
  meta: projectMetaSchema,
});

const listProjectsQuerySchema = z.object({
  status: projectStatusSchema.optional(),
  search: z.string().optional(),
  sort: z.enum(['updated_at_asc', 'updated_at_desc']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const updateProjectBodySchema = z.object({
  meta: projectMetaSchema.partial().optional(),
  status: projectStatusSchema.optional(),
});

export function createProjectRouter(service: ProjectService): Router {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const query = listProjectsQuerySchema.parse(req.query);
      const result = await service.listProjects(query);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const body = createProjectBodySchema.parse(req.body);
      const project = await service.createProject({ meta: body.meta });
      res.status(201).json({ data: project });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const project = await service.getProject(req.params.id);

      if (!project) {
        res.status(404).json({ error: { message: 'Project not found' } });
        return;
      }

      res.json({ data: project });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const body = updateProjectBodySchema.parse(req.body);
      const project = await service.updateProject(req.params.id, body);
      res.json({ data: project });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await service.deleteProject(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
