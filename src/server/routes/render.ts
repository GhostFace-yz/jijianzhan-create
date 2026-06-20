import { Router } from 'express';
import { z } from 'zod';
import type { RenderService } from '../services/render/types.js';

// ── Validation Schemas ─────────────────────────────────────────────

const epIdParamSchema = z
  .string()
  .regex(/^ep-\d+$/, 'Invalid episode ID format. Expected: ep-{number}');

const renderOptionsSchema = z.object({
  provider: z.string().max(50).optional(),
  resolution: z.enum(['1080x1920', '1920x1080']).optional(),
  fps: z.union([z.literal(24), z.literal(30)]).optional(),
  codec: z.enum(['h264', 'h265']).optional(),
  subtitles_enabled: z.boolean().optional(),
  subtitle_style: z.enum(['white_with_black_border', 'white', 'black']).optional(),
  subtitle_position: z.enum(['bottom', 'top']).optional(),
  subtitle_size: z.enum(['small', 'medium', 'large']).optional(),
  music_duck_dialogue: z.number().min(0.2).max(0.4).optional(),
  music_duck_nondialogue: z.number().min(0.6).max(0.9).optional(),
  strong_emotion_transition: z.enum(['white_flash', 'black_fade']).optional(),
});

// ── Router Factory ─────────────────────────────────────────────────

export function createRenderRouter(renderService: RenderService): Router {
  const router = Router({ mergeParams: true });

  // POST /api/v1/projects/:projectId/episodes/:epId/render
  router.post('/', async (req, res, next) => {
    try {
      const { projectId, epId } = req.params as Record<string, string>;

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

      const body = renderOptionsSchema.safeParse(req.body || {});
      if (!body.success) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            details: body.error.issues.map((i) => ({
              path: i.path,
              message: i.message,
            })),
          },
        });
        return;
      }

      const result = await renderService.startRender(projectId, epId, body.data);
      const statusCode = result.status === 'queued' ? 202 : 201;
      res.status(statusCode).json({ data: result });
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes('Invalid episode ID') ||
          error.message.includes('No storyboard nodes') ||
          error.message.includes('have not been generated') ||
          error.message.includes('still pending') ||
          error.message.includes('Generate video first') ||
          error.message.includes('Generate music first') ||
          error.message.includes('Music has not been generated')
        ) {
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

  // GET /api/v1/projects/:projectId/episodes/:epId/render/progress
  router.get('/progress', async (req, res, next) => {
    try {
      const { projectId, epId } = req.params as Record<string, string>;

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

      const result = await renderService.getProgress(projectId, epId);
      if (!result) {
        res.status(404).json({ error: { message: `No render found for episode ${epId}` } });
        return;
      }

      res.json({ data: result });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid episode ID')) {
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

  // GET /api/v1/projects/:projectId/episodes/:epId/render/download
  router.get('/download', async (req, res, next) => {
    try {
      const { projectId, epId } = req.params as Record<string, string>;

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

      const url = await renderService.getDownloadUrl(projectId, epId);
      if (!url) {
        res.status(404).json({
          error: { message: `Render not completed or not found for episode ${epId}` },
        });
        return;
      }

      res.json({ data: { url } });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid episode ID')) {
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

  return router;
}
