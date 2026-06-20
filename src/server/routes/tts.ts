import { Router } from 'express';
import { z } from 'zod';
import type { TtsService } from '../services/storyboard/types.js';

// ── Validation Schemas ─────────────────────────────────────────────

const epIdParamSchema = z.string().regex(/^ep-\d+$/, 'Invalid episode ID format. Expected: ep-{number}');

const generateTtsBodySchema = z.object({
  speed: z.number().min(0.8).max(1.2).optional(),
  emotion: z.string().max(50).optional(),
  voice_id: z.string().max(100).optional(),
  force: z.boolean().optional(),
  provider: z.string().max(50).optional(),
});

const reviewTtsBodySchema = z.object({
  approved: z.boolean(),
  comment: z.string().max(500).optional(),
});

const uploadTtsBodySchema = z.object({
  url: z.string().url('Must be a valid URL'),
  duration: z.number().positive('Duration must be positive'),
});

// ── Router Factory ─────────────────────────────────────────────────

export function createTtsRouter(ttsService: TtsService): Router {
  const router = Router({ mergeParams: true });

  // POST /api/v1/projects/:projectId/episodes/:epId/audio/tts/generate
  // Batch generate TTS audio for all dialogue nodes in an episode
  router.post('/generate', async (req, res, next) => {
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

      const body = generateTtsBodySchema.safeParse(req.body || {});
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

      const result = await ttsService.generateBatchTts(projectId, epId, body.data);
      res.status(201).json({ data: result });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('No storyboard nodes')) {
          res.status(400).json({ error: { message: error.message } });
          return;
        }
        if (error.message.includes('Invalid episode ID')) {
          res.status(400).json({ error: { message: error.message } });
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

  // POST /api/v1/projects/:projectId/episodes/:epId/audio/tts/nodes/:nodeId/generate
  // Generate TTS audio for a single storyboard node
  router.post('/nodes/:nodeId/generate', async (req, res, next) => {
    try {
      const { projectId, epId, nodeId } = req.params as Record<string, string>;

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

      const body = generateTtsBodySchema.safeParse(req.body || {});
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

      const result = await ttsService.generateNodeTts(projectId, epId, nodeId, body.data);
      res.status(201).json({ data: result });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: { message: error.message } });
        return;
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

  // PUT /api/v1/projects/:projectId/episodes/:epId/audio/tts/nodes/:nodeId/review
  // Review (approve/reject) generated TTS audio for a node
  router.put('/nodes/:nodeId/review', async (req, res, next) => {
    try {
      const { projectId, epId, nodeId } = req.params as Record<string, string>;

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

      const body = reviewTtsBodySchema.parse(req.body);
      const result = await ttsService.reviewNodeTts(projectId, epId, nodeId, body);
      res.json({ data: result });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: { message: error.message } });
        return;
      }
      if (error instanceof Error && error.message.includes('not been generated')) {
        res.status(400).json({ error: { message: error.message } });
        return;
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

  // PUT /api/v1/projects/:projectId/episodes/:epId/audio/tts/nodes/:nodeId/upload
  // Replace generated TTS audio with a manually uploaded recording file
  router.put('/nodes/:nodeId/upload', async (req, res, next) => {
    try {
      const { projectId, epId, nodeId } = req.params as Record<string, string>;

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

      const body = uploadTtsBodySchema.parse(req.body);
      const result = await ttsService.uploadNodeTts(projectId, epId, nodeId, body);
      res.json({ data: result });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: { message: error.message } });
        return;
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
