import { Router } from 'express';
import { z } from 'zod';
import type { StoryboardService } from '../services/storyboard/types.js';
import type { StoryboardImageService } from '../services/storyboard/storyboard-image-types.js';

function routeParams(req: { params: Record<string, string> }): Record<string, string> {
  return req.params;
}

// ── Validation Schemas ─────────────────────────────────────────────

const epIdParamSchema = z.string().regex(/^ep-\d+$/, 'Invalid episode ID format. Expected: ep-{number}');

const splitNodeBodySchema = z.object({
  split_point_seconds: z.number().min(2).max(13).optional(),
});

const updateNodesBodySchema = z.object({
  nodes: z.array(z.any()).min(1, 'Nodes array must not be empty'),
});

const generateNodeImageBodySchema = z.object({
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(),
  style_preset: z.string().max(100).optional(),
  force: z.boolean().optional(),
});

const reviewBodySchema = z.object({
  approved: z.boolean(),
  comment: z.string().max(500).optional(),
});

// ── Router Factory ─────────────────────────────────────────────────

export function createStoryboardRouter(
  service: StoryboardService,
  imageService?: StoryboardImageService,
): Router {
  const router = Router({ mergeParams: true });

  // POST /api/v1/projects/:projectId/episodes/:epId/storyboard/split
  router.post('/split', async (req, res, next) => {
    try {
      const { projectId, epId } = routeParams(req);

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

      const result = await service.splitScript(projectId, epId);
      res.status(201).json({ data: result });
    } catch (error) {
      // Service-level errors that should return 400
      if (error instanceof Error) {
        if (error.message.includes('No script found')) {
          res.status(400).json({ error: { message: error.message } });
          return;
        }
        if (error.message.includes('Project not found')) {
          res.status(500).json({ error: { message: error.message } });
          return;
        }
      }
      next(error);
    }
  });

  // GET /api/v1/projects/:projectId/episodes/:epId/storyboard/nodes
  router.get('/nodes', async (req, res, next) => {
    try {
      const { projectId, epId } = routeParams(req);

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

      const nodes = await service.getNodes(projectId, epId);
      res.json({ data: nodes });
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/v1/projects/:projectId/episodes/:epId/storyboard/nodes
  router.put('/nodes', async (req, res, next) => {
    try {
      const { projectId, epId } = routeParams(req);

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

      const body = updateNodesBodySchema.parse(req.body);

      // Validate each node structurally (service does full validation)
      if (!Array.isArray(body.nodes) || body.nodes.length === 0) {
        res.status(400).json({
          error: { message: 'Validation failed', details: [{ path: ['nodes'], message: 'Nodes array must not be empty' }] },
        });
        return;
      }

      const nodes = await service.updateNodes(projectId, epId, { nodes: body.nodes });
      res.json({ data: nodes });
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            details: error.issues.map((i) => ({ path: i.path, message: i.message })),
          },
        });
        return;
      }
      // Service validation errors
      if (error instanceof Error && error.message.includes('Invalid node data')) {
        res.status(400).json({ error: { message: 'Validation failed', details: [{ path: [], message: error.message }] } });
        return;
      }
      next(error);
    }
  });

  // POST /api/v1/projects/:projectId/episodes/:epId/storyboard/nodes/:nodeId/split
  router.post('/nodes/:nodeId/split', async (req, res, next) => {
    try {
      const { projectId, epId, nodeId } = routeParams(req);

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

      const body = splitNodeBodySchema.safeParse(req.body);
      const input = body.success ? body.data : undefined;

      const result = await service.splitNode(projectId, epId, nodeId, input);
      res.json({ data: result });
    } catch (error) {
      // Handle node not found as 404
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

  // ── Image Generation Routes ─────────────────────────────────────

  if (imageService) {
    // POST /nodes/generate — batch generate images for all nodes
    router.post('/nodes/generate', async (req, res, next) => {
      try {
        const { projectId, epId } = routeParams(req);

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

        const body = generateNodeImageBodySchema.safeParse(req.body);
        const options = body.success ? body.data : {};

        const result = await imageService.generateBatchImages(projectId, epId, options);
        res.json({ data: result });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('No storyboard nodes')) {
            res.status(400).json({ error: { message: error.message } });
            return;
          }
          if (error.message.includes('Project not found')) {
            res.status(500).json({ error: { message: error.message } });
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

    // POST /nodes/:nodeId/generate — generate image for a single node
    router.post('/nodes/:nodeId/generate', async (req, res, next) => {
      try {
        const { projectId, epId, nodeId } = routeParams(req);

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

        const body = generateNodeImageBodySchema.safeParse(req.body);
        const options = body.success ? body.data : {};

        const result = await imageService.generateNodeImage(projectId, epId, nodeId, options);
        res.json({ data: result });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          res.status(404).json({ error: { message: error.message } });
          return;
        }
        if (error instanceof Error && error.message.includes('Project not found')) {
          res.status(500).json({ error: { message: error.message } });
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

    // PUT /nodes/:nodeId/review — review a generated node image
    router.put('/nodes/:nodeId/review', async (req, res, next) => {
      try {
        const { projectId, epId, nodeId } = routeParams(req);

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

        const body = reviewBodySchema.parse(req.body);

        const result = await imageService.reviewNodeImage(projectId, epId, nodeId, body);
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
  }

  return router;
}
