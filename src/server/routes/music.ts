import { Router } from 'express';
import { z } from 'zod';
import type { MusicService } from '../services/music/types.js';

// ── Validation Schemas ─────────────────────────────────────────────

const epIdParamSchema = z.string().regex(/^ep-\d+$/, 'Invalid episode ID format. Expected: ep-{number}');

const generateBodySchema = z.object({
  provider: z.string().max(100).optional(),
  style_tags: z.array(z.string().max(50)).max(20).optional(),
  crossfade_duration: z.number().min(0.1).max(1.0).optional(),
});

const uploadBodySchema = z.object({
  url: z.string().url('Must be a valid URL starting with http:// or https://'),
  duration: z.number().positive('Duration must be a positive number'),
});

// ── Router Factory ─────────────────────────────────────────────────

export function createMusicRouter(service: MusicService): Router {
  const router = Router({ mergeParams: true });

  // GET /api/v1/projects/:projectId/episodes/:epId/audio/music
  router.get('/', async (req, res, next) => {
    try {
      const { projectId, epId } = req.params as { projectId: string; epId: string };

      // Validate episode ID
      const epIdParsed = epIdParamSchema.safeParse(epId);
      if (!epIdParsed.success) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            details: epIdParsed.error.issues.map((i) => ({
              path: i.path,
              message: i.message,
            })),
          },
        });
        return;
      }

      const result = await service.getMusic(projectId, epId);
      if (!result) {
        res.status(404).json({ error: { message: 'Music not found for this episode' } });
        return;
      }
      res.json({ data: result });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid episode ID format')) {
          res.status(400).json({ error: { message: error.message } });
          return;
        }
        if (error.message.includes('Project not found')) {
          res.status(404).json({ error: { message: error.message } });
          return;
        }
      }
      next(error);
    }
  });

  // POST /api/v1/projects/:projectId/episodes/:epId/audio/music/generate
  router.post('/generate', async (req, res, next) => {
    try {
      const { projectId, epId } = req.params as { projectId: string; epId: string };

      // Validate episode ID
      const epIdParsed = epIdParamSchema.safeParse(epId);
      if (!epIdParsed.success) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            details: epIdParsed.error.issues.map((i) => ({
              path: i.path,
              message: i.message,
            })),
          },
        });
        return;
      }

      const body = generateBodySchema.safeParse(req.body ?? {});
      const options = body.success ? body.data : {};

      const result = await service.generateMusic(projectId, epId, options);
      res.status(201).json({ data: result });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid episode ID format')) {
          res.status(400).json({ error: { message: error.message } });
          return;
        }
        if (error.message.includes('No storyboard nodes')) {
          res.status(400).json({ error: { message: error.message } });
          return;
        }
        if (error.message.includes('Project not found')) {
          res.status(404).json({ error: { message: error.message } });
          return;
        }
      }
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            details: error.issues.map((i) => ({ path: i.path, message: i.message })),
          },
        });
        return;
      }
      next(error);
    }
  });

  // PUT /api/v1/projects/:projectId/episodes/:epId/audio/music/upload
  router.put('/upload', async (req, res, next) => {
    try {
      const { projectId, epId } = req.params as { projectId: string; epId: string };

      // Validate episode ID
      const epIdParsed = epIdParamSchema.safeParse(epId);
      if (!epIdParsed.success) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            details: epIdParsed.error.issues.map((i) => ({
              path: i.path,
              message: i.message,
            })),
          },
        });
        return;
      }

      const body = uploadBodySchema.parse(req.body);

      const result = await service.uploadMusic(projectId, epId, body);
      res.json({ data: result });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid episode ID format')) {
          res.status(400).json({ error: { message: error.message } });
          return;
        }
        if (error.message.includes('Invalid URL')) {
          res.status(400).json({ error: { message: error.message } });
          return;
        }
        if (error.message.includes('Duration must be')) {
          res.status(400).json({ error: { message: error.message } });
          return;
        }
        if (error.message.includes('Project not found')) {
          res.status(404).json({ error: { message: error.message } });
          return;
        }
      }
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            details: error.issues.map((i) => ({ path: i.path, message: i.message })),
          },
        });
        return;
      }
      next(error);
    }
  });

  return router;
}
