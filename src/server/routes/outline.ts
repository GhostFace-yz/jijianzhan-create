import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import type { OutlineService } from '../services/outline/types.js';

// ── Validation Schemas ─────────────────────────────────────────────

const outlineCharacterSchema = z.object({
  name: z.string().min(1, '角色名不能为空'),
  role_type: z.enum(['protagonist', 'supporting', 'antagonist']).optional(),
  description: z.string().min(1, '角色描述不能为空'),
});

const outlineLocationSchema = z.object({
  name: z.string().min(1, '场景名不能为空'),
  description: z.string().min(1, '场景描述不能为空'),
});

const outlineEpisodeSchema = z.object({
  episode_number: z.number().int().min(1),
  title: z.string().min(1, '集标题不能为空'),
  summary: z.string().min(1, '集摘要不能为空'),
  key_events: z.array(z.string().min(1)).min(1, '至少需要一个关键事件'),
  featured_characters: z.array(z.string().min(1)).min(1, '至少需要一个出场角色'),
  featured_locations: z.array(z.string().min(1)).min(1, '至少需要一个出场场景'),
});

const updateOutlineBodySchema = z.object({
  world_setting: z.string().min(1).optional(),
  main_conflict: z.string().min(1).optional(),
  characters: z.array(outlineCharacterSchema).min(1).optional(),
  locations: z.array(outlineLocationSchema).min(1).optional(),
  episode_count: z.number().int().min(1).optional(),
  episodes: z.array(outlineEpisodeSchema).min(1).optional(),
});

// ── Router Factory ─────────────────────────────────────────────────

export function createOutlineRouter(service: OutlineService): Router {
  const router = Router({ mergeParams: true });

  // POST /api/v1/projects/:projectId/outline/generate
  router.post('/generate', async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const outline = await service.generateOutline(projectId);
      res.status(201).json({ data: outline });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/projects/:projectId/outline
  router.get('/', async (req, res, next) => {
    try {
      const { projectId } = req.params;

      const outline = await service.getOutline(projectId);

      // Fetch project-level fields for the summary response
      const project = await prisma.projects.findUnique({
        where: { id: projectId },
        select: { outline_locked: true, status: true },
      });

      res.json({
        data: {
          outline,
          outline_locked: project?.outline_locked ?? false,
          project_status: project?.status ?? 'draft',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/v1/projects/:projectId/outline
  router.put('/', async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const body = updateOutlineBodySchema.parse(req.body);
      const outline = await service.updateOutline(projectId, body);
      res.json({ data: outline });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/projects/:projectId/outline/episodes/:episodeNumber/regenerate
  router.post('/episodes/:episodeNumber/regenerate', async (req, res, next) => {
    try {
      const { projectId, episodeNumber } = req.params;
      const epNum = parseInt(episodeNumber, 10);

      if (isNaN(epNum) || epNum < 1) {
        res.status(400).json({ error: { message: 'Invalid episode number' } });
        return;
      }

      const outline = await service.regenerateEpisode(projectId, epNum);
      const episode = outline.episodes.find((e) => e.episode_number === epNum);

      if (!episode) {
        res.status(404).json({ error: { message: `Episode ${epNum} not found after regeneration` } });
        return;
      }

      res.json({ data: { episode, episode_number: epNum } });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/projects/:projectId/outline/validate
  router.post('/validate', async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const report = await service.validateOutline(projectId);
      res.json({ data: report });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/projects/:projectId/outline/confirm
  router.post('/confirm', async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const outline = await service.confirmOutline(projectId);
      res.json({ data: outline });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
