import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'node:path';
import os from 'node:os';
import { unlink } from 'node:fs/promises';
import type { VideoService } from '../services/video/types.js';
import type { StorageService } from '../services/storage/types.js';

// ── Validation Schemas ─────────────────────────────────────────────

const epIdParamSchema = z.string().regex(/^ep-\d+$/, 'Invalid episode ID format. Expected: ep-{number}');

const generateVideoBodySchema = z.object({
  provider: z.string().max(50).optional(),
  fallback_provider: z.string().max(50).optional(),
  force: z.boolean().optional(),
  concurrency: z.number().int().min(1).max(10).optional(),
  duration: z.number().min(3).max(15).optional(),
  face_enhancement: z.boolean().optional(),
});

const reviewVideoBodySchema = z.object({
  approved: z.boolean(),
  comment: z.string().max(500).optional(),
});

const uploadVideoBodySchema = z.object({
  url: z.string().url('Must be a valid URL'),
  duration: z.number().positive('Duration must be positive'),
  camera_move: z.string().max(100).optional(),
  motion_description: z.string().max(2000).optional(),
});

const uploadVideoFileBodySchema = z.object({
  duration: z.coerce.number().positive('Duration must be positive').optional(),
  camera_move: z.string().max(100).optional(),
  motion_description: z.string().max(2000).optional(),
});

// ── Multer Configuration ───────────────────────────────────────────

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
});

// ── Router Factory ─────────────────────────────────────────────────

export function createVideoRouter(videoService: VideoService, storage?: StorageService): Router {
  const router = Router({ mergeParams: true });

  // POST /api/v1/projects/:projectId/episodes/:epId/video/generate
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

      const body = generateVideoBodySchema.safeParse(req.body || {});
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

      const result = await videoService.generateBatchVideo(projectId, epId, body.data);
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

  // POST /api/v1/projects/:projectId/episodes/:epId/video/nodes/:nodeId/generate
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

      const body = generateVideoBodySchema.safeParse(req.body || {});
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

      const result = await videoService.generateNodeVideo(projectId, epId, nodeId, body.data);
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

  // PUT /api/v1/projects/:projectId/episodes/:epId/video/nodes/:nodeId/review
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

      const body = reviewVideoBodySchema.parse(req.body);
      const result = await videoService.reviewNodeVideo(projectId, epId, nodeId, body);
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

  // PUT /api/v1/projects/:projectId/episodes/:epId/video/nodes/:nodeId/upload
  // Replace generated video clip with a manually uploaded video file URL
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

      const body = uploadVideoBodySchema.parse(req.body);
      const result = await videoService.uploadNodeVideo(projectId, epId, nodeId, body);
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

  // POST /api/v1/projects/:projectId/episodes/:epId/video/nodes/:nodeId/upload
  // Upload a video file directly and replace the node's video_clip
  router.post('/nodes/:nodeId/upload', upload.single('video'), async (req, res, next) => {
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

      if (!storage) {
        res.status(500).json({
          error: { message: 'Storage service is not configured for video uploads' },
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          error: { message: 'Validation failed', details: [{ path: ['video'], message: 'Video file is required' }] },
        });
        return;
      }

      const body = uploadVideoFileBodySchema.safeParse(req.body || {});
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

      const ext = path.extname(req.file.originalname) || '.mp4';
      const safeName = `uploaded-${Date.now()}${ext}`;
      const storageKey = `projects/${projectId}/episodes/${epId}/nodes/${nodeId}/${safeName}`;

      const { url } = await storage.save(req.file.path, storageKey);

      // Clean up the temporary file after copying to persistent storage
      try {
        await unlink(req.file.path);
      } catch {
        // Best-effort cleanup; ignore failures
      }

      const result = await videoService.uploadNodeVideo(projectId, epId, nodeId, {
        url,
        duration: body.data.duration,
        camera_move: body.data.camera_move,
        motion_description: body.data.motion_description,
      });

      res.status(201).json({ data: result });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: { message: error.message } });
        return;
      }
      if (
        (error instanceof Error && error.name === 'MulterError') ||
        (error instanceof Error && error.message.includes('Only video files are allowed'))
      ) {
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

  return router;
}
