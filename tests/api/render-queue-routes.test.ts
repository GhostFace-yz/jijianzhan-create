import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { AdapterPool } from '../../src/server/adapters/pool.js';
import { MockImageAdapter } from '../../src/server/adapters/providers/mock/mock-image-adapter.js';
import { MockTextAdapter } from '../../src/server/adapters/providers/mock/mock-text-adapter.js';
import { MockMusicAdapter } from '../../src/server/adapters/providers/mock/mock-music-adapter.js';
import { MockRenderAdapter } from '../../src/server/adapters/providers/mock/mock-render-adapter.js';
import { MockTTSAdapter } from '../../src/server/adapters/providers/mock/mock-tts-adapter.js';
import { MockVideoAdapter } from '../../src/server/adapters/providers/mock/mock-video-adapter.js';
import { cleanProjects, cleanSnapshots, disconnectTestDb, testPrisma } from '../helpers/prisma.js';
import { createSnapshotService } from '../../src/server/services/snapshot/snapshot-service.js';
import { createChangePropagationService } from '../../src/server/services/snapshot/propagation.js';
import { createCharacterService } from '../../src/server/services/character/character-service.js';
import { createSceneBibleService } from '../../src/server/services/scene-bible/scene-bible-service.js';
import { createStoryboardService } from '../../src/server/services/storyboard/storyboard-service.js';
import { createMusicService } from '../../src/server/services/music/music-service.js';
import { createRenderService } from '../../src/server/services/render/render-service.js';
import { createRenderRouter } from '../../src/server/routes/render.js';
import { createTestApp } from '../helpers/app.js';
import type { StoryboardNode, EpisodesStoryboard } from '../../src/server/services/storyboard/types.js';
import type { EpisodeMusic, ProjectMusic } from '../../src/server/services/music/types.js';

function createQueueApp(prisma: PrismaClient) {
  const app = express();
  app.use(express.json());

  const adapterPool = new AdapterPool();
  adapterPool.registerImage(new MockImageAdapter());
  adapterPool.registerText(new MockTextAdapter());
  adapterPool.registerMusic(new MockMusicAdapter());
  adapterPool.registerTTS(new MockTTSAdapter());
  adapterPool.registerVideo(new MockVideoAdapter());
  adapterPool.registerRender(new MockRenderAdapter());

  const propagationService = createChangePropagationService({ prisma });
  const snapshotService = createSnapshotService({
    prisma,
    onRollback: propagationService.markDownstreamForReview,
  });
  const characterService = createCharacterService({ prisma, snapshotService, adapterPool });
  const sceneBibleService = createSceneBibleService({ prisma, snapshotService, adapterPool });
  const storyboardService = createStoryboardService({ prisma, snapshotService, adapterPool });
  const musicService = createMusicService({
    storyboardService,
    adapterPool,
    prisma,
    snapshotService,
  });

  const addedJobs: Array<{ data: Record<string, unknown> }> = [];
  const mockQueue = {
    add: async (_name: string, data: Record<string, unknown>) => {
      addedJobs.push({ data });
      return { id: `job-${addedJobs.length}` };
    },
    getAddedJobs: () => addedJobs,
  };

  const renderService = createRenderService({
    storyboardService,
    musicService,
    adapterPool,
    snapshotService,
    queue: mockQueue,
  });

  app.use(
    '/api/v1/projects/:projectId/episodes/:epId/render',
    createRenderRouter(renderService)
  );

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: {
          message: 'Validation failed',
          details: err.issues.map((issue) => ({ path: issue.path, message: issue.message })),
        },
      });
      return;
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: { message } });
  });

  return { app, mockQueue };
}

const validProject = {
  meta: {
    title: '测试短剧',
    description: '测试队列合成功能',
    genre: 'urban_romance',
    target_episodes: 6,
    duration_goal: '5min',
    style_tags: ['realistic', 'fresh'],
  },
};

const episodeId = 'ep-1';

function createMockNodes(): StoryboardNode[] {
  return [
    {
      node_id: 'ep01-n001',
      scene_id: 's1',
      scene_variant: '白天-晴',
      characters: [{ char_id: '主角', costume_variant: '默认服装' }],
      shot_type: 'wide-shot',
      camera_move: 'static',
      visual_desc: '城市全景，主角走在街道上',
      dialogue: { char_id: '主角', text: '今天天气真好', emotion: '开心的' },
      emotion_tag: '开心的',
      music_mood: '轻快',
      duration_target: 6,
      transition_in: 'fade',
      transition_out: 'cut',
      status: 'completed',
      version_history: [],
      audio_clip: {
        url: 'https://mock-cdn.example.com/tts/1.mp3',
        duration: 2.5,
        voice_id: 'voice-1',
        emotion: 'happy',
        speed: 1,
        generated_at: new Date().toISOString(),
        status: 'generated',
      },
      video_clip: {
        url: 'https://mock-cdn.example.com/video/1.mp4',
        duration: 6,
        camera_move: 'none',
        motion_description: 'static shot',
        generated_at: new Date().toISOString(),
        status: 'generated',
        quality_report: {
          actual_duration: 6,
          target_duration: 6,
          duration_ok: true,
          face_corruption_detected: false,
          motion_jump_detected: false,
          passed: true,
          details: ['ok'],
        },
        provider: 'mock-video',
        model: 'video-model',
        fallback_used: false,
      },
    },
  ];
}

async function createProjectWithRenderedAssets(): Promise<string> {
  const createRes = await request(createTestApp(testPrisma))
    .post('/api/v1/projects')
    .send(validProject);
  const projectId = createRes.body.data.id;

  const nodes = createMockNodes();
  const storyboardData: EpisodesStoryboard = { [episodeId]: nodes };

  const episodeMusic: EpisodeMusic = {
    original_url: 'https://mock-cdn.example.com/music/ep1.mp3',
    duration: 15,
    segments: [
      {
        node_id: 'ep01-n001',
        start_time: 0,
        duration: 6,
        url: 'https://mock-cdn.example.com/music/ep1.mp3',
        volume: 0.25,
        ducked: true,
        crossfade_in: 0,
        crossfade_out: 0,
      },
    ],
    generated_at: new Date().toISOString(),
    provider: 'mock-music',
    model: 'music-model',
  };
  const musicData: ProjectMusic = { [episodeId]: episodeMusic };

  await testPrisma.projects.update({
    where: { id: projectId },
    data: {
      storyboard_nodes: storyboardData as unknown as Prisma.InputJsonValue,
      music: musicData as unknown as Prisma.InputJsonValue,
    },
  });

  return projectId;
}

describe('render async queue routes', () => {
  beforeEach(async () => {
    await cleanProjects();
    await cleanSnapshots();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('POST /render with queue returns 202 and job_id', async () => {
    const projectId = await createProjectWithRenderedAssets();
    const { app, mockQueue } = createQueueApp(testPrisma);

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${episodeId}/render`)
      .send({});

    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe('queued');
    expect(res.body.data.job_id).toBeTruthy();
    expect(mockQueue.getAddedJobs()).toHaveLength(1);
    expect(mockQueue.getAddedJobs()[0].data.projectId).toBe(projectId);
    expect(mockQueue.getAddedJobs()[0].data.episodeId).toBe(episodeId);
  });
});
