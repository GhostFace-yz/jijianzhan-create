import { Router } from 'express';
import { z, ZodError } from 'zod';
import type { ScriptService } from '../services/script/types.js';
import { updateScriptSchema } from '../services/script/script-service.js';

function routeParams(req: { params: Record<string, string> }): Record<string, string> {
  return req.params;
}

const epIdParamSchema = z.string().regex(/^ep-\d+|\d+$/, 'Invalid episode ID format. Expected: ep-{number} or {number}');

const regenerateSceneBodySchema = z.object({
  scene_id: z.string().min(1, 'scene_id is required'),
});

function parseEpisodeNumber(epId: string): number {
  const parsed = epIdParamSchema.safeParse(epId);
  if (!parsed.success) {
    throw new Error('Invalid episode ID format. Expected: ep-{number} or {number}');
  }
  const digits = epId.startsWith('ep-') ? epId.replace('ep-', '') : epId;
  const num = parseInt(digits, 10);
  if (Number.isNaN(num) || num < 1) {
    throw new Error('Invalid episode number');
  }
  return num;
}

export function createScriptRouter(service: ScriptService): Router {
  const router = Router({ mergeParams: true });

  // GET /api/v1/projects/:projectId/episodes/:epId/script
  router.get('/', async (req, res, next) => {
    try {
      const { projectId, epId } = routeParams(req);
      const episodeNumber = parseEpisodeNumber(epId);

      const script = await service.getScript(projectId, episodeNumber);
      if (!script) {
        res.status(404).json({ error: { message: `Script not found for episode ${episodeNumber}` } });
        return;
      }

      res.json({ data: script });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid episode ID')) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            details: [{ path: ['epId'], message: error.message }],
          },
        });
        return;
      }
      if (error instanceof Error && error.message.includes('Project not found')) {
        res.status(500).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  });

  // POST /api/v1/projects/:projectId/episodes/:epId/script/generate
  router.post('/generate', async (req, res, next) => {
    try {
      const { projectId, epId } = routeParams(req);
      const episodeNumber = parseEpisodeNumber(epId);

      const script = await service.generateScript(projectId, episodeNumber);
      res.status(201).json({ data: script });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid episode ID')) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            details: [{ path: ['epId'], message: error.message }],
          },
        });
        return;
      }
      if (error instanceof Error && error.message.includes('Project not found')) {
        res.status(500).json({ error: { message: error.message } });
        return;
      }
      if (error instanceof Error && error.message.includes('No outline found')) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  });

  // PUT /api/v1/projects/:projectId/episodes/:epId/script
  router.put('/', async (req, res, next) => {
    try {
      const { projectId, epId } = routeParams(req);
      const episodeNumber = parseEpisodeNumber(epId);

      const body = updateScriptSchema.parse(req.body);
      const script = await service.updateScript(projectId, episodeNumber, body);
      res.json({ data: script });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            details: error.issues.map((i) => ({ path: i.path, message: i.message })),
          },
        });
        return;
      }
      if (error instanceof Error && error.message.includes('Invalid episode ID')) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            details: [{ path: ['epId'], message: error.message }],
          },
        });
        return;
      }
      if (error instanceof Error && error.message.includes('Project not found')) {
        res.status(500).json({ error: { message: error.message } });
        return;
      }
      if (error instanceof Error && error.message.includes('Script not found')) {
        res.status(404).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  });

  // POST /api/v1/projects/:projectId/episodes/:epId/script/regenerate-scene
  router.post('/regenerate-scene', async (req, res, next) => {
    try {
      const { projectId, epId } = routeParams(req);
      const episodeNumber = parseEpisodeNumber(epId);

      const body = regenerateSceneBodySchema.parse(req.body);
      const scene = await service.regenerateScene(projectId, episodeNumber, body.scene_id);
      res.json({ data: scene });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            details: error.issues.map((i) => ({ path: i.path, message: i.message })),
          },
        });
        return;
      }
      if (error instanceof Error && error.message.includes('Invalid episode ID')) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            details: [{ path: ['epId'], message: error.message }],
          },
        });
        return;
      }
      if (error instanceof Error && error.message.includes('Project not found')) {
        res.status(500).json({ error: { message: error.message } });
        return;
      }
      if (error instanceof Error && error.message.includes('No outline found')) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  });

  return router;
}
