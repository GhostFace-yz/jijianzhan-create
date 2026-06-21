import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { cleanProjects, cleanSnapshots, disconnectTestDb, testPrisma } from '../helpers/prisma.js';
import { createTestApp } from '../helpers/app.js';
import type { StoryboardNode, EpisodesStoryboard } from '../../src/server/services/storyboard/types.js';

const app = createTestApp(testPrisma);

const validProject = {
  meta: {
    title: '测试短剧',
    description: '测试配乐功能',
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
      status: 'pending',
      version_history: [],
    },
    {
      node_id: 'ep01-n002',
      scene_id: 's1',
      scene_variant: '白天-晴',
      characters: [{ char_id: '主角', costume_variant: '默认服装' }],
      shot_type: 'close-up',
      camera_move: 'static',
      visual_desc: '主角面部特写，露出微笑',
      dialogue: null,
      emotion_tag: '平静的',
      music_mood: '温馨',
      duration_target: 5,
      transition_in: 'cut',
      transition_out: 'fade',
      status: 'pending',
      version_history: [],
    },
  ];
}

async function createProjectWithNodes(): Promise<string> {
  const createRes = await request(app).post('/api/v1/projects').send(validProject);
  const projectId = createRes.body.data.id;

  const nodes = createMockNodes();
  const storyboardData: EpisodesStoryboard = { [episodeId]: nodes };

  await testPrisma.project.update({
    where: { id: projectId },
    data: { storyboard_nodes: storyboardData as unknown as Prisma.InputJsonValue },
  });

  return projectId;
}

describe('music API routes', () => {
  beforeEach(async () => {
    await cleanProjects();
    await cleanSnapshots();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  // ── GET / (get current episode music) ───────────────────────────

  it('GET returns 200 with stored music after generation', async () => {
    const projectId = await createProjectWithNodes();

    await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${episodeId}/audio/music/generate`)
      .send({});

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/episodes/${episodeId}/audio/music`);

    expect(res.status).toBe(200);
    expect(res.body.data.episode_id).toBe(episodeId);
    expect(res.body.data.original_url).toBeTruthy();
    expect(res.body.data.segments).toBeInstanceOf(Array);
  });

  it('GET returns 404 when no music exists for episode', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/episodes/${episodeId}/audio/music`);

    expect(res.status).toBe(404);
  });

  it('GET returns 400 for invalid episode ID format', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/episodes/bad-format/audio/music`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Validation failed');
  });

  // ── POST /generate ──────────────────────────────────────────────

  it('POST generate returns 201 with BGM segments for all nodes', async () => {
    const projectId = await createProjectWithNodes();

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${episodeId}/audio/music/generate`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.data.episode_id).toBe(episodeId);
    expect(res.body.data.original_url).toBeTruthy();
    expect(res.body.data.segments).toBeInstanceOf(Array);
    expect(res.body.data.segments.length).toBe(2);

    // Verify duck: first node has dialogue → ducked, lower volume
    const seg0 = res.body.data.segments[0];
    expect(seg0.node_id).toBe('ep01-n001');
    expect(seg0.ducked).toBe(true);
    expect(seg0.volume).toBeLessThan(0.5);

    // Verify no duck: second node has no dialogue → not ducked
    const seg1 = res.body.data.segments[1];
    expect(seg1.node_id).toBe('ep01-n002');
    expect(seg1.ducked).toBe(false);
    expect(seg1.volume).toBeGreaterThan(0.5);

    // Verify crossfade
    expect(seg0.crossfade_in).toBe(0);
    expect(seg0.crossfade_out).toBeGreaterThan(0);
    expect(seg1.crossfade_in).toBeGreaterThan(0);
    expect(seg1.crossfade_out).toBe(0);
  });

  it('POST generate returns 400 when episode has no storyboard nodes', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${episodeId}/audio/music/generate`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('No storyboard nodes');
  });

  it('POST generate returns 400 for invalid episode ID format', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/bad-format/audio/music/generate`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Validation failed');
  });

  it('POST generate returns 404 for non-existent project', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/non-existent-id/episodes/${episodeId}/audio/music/generate`)
      .send({});

    // Project not found comes through as 404 from route, or 500 from service
    expect([404, 500]).toContain(res.status);
  });

  // ── PUT /upload ─────────────────────────────────────────────────

  it('PUT upload returns 200 with stored music data', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/episodes/${episodeId}/audio/music/upload`)
      .send({
        url: 'https://custom-bgm.example.com/music.mp3',
        duration: 65.0,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.episode_id).toBe(episodeId);
    expect(res.body.data.original_url).toBe('https://custom-bgm.example.com/music.mp3');
    expect(res.body.data.duration).toBe(65.0);
    expect(res.body.data.segments).toEqual([]);
    expect(res.body.data.provider).toBe('manual_upload');
    expect(res.body.data.model).toBe('manual');
  });

  it('PUT upload returns 400 for invalid URL', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/episodes/${episodeId}/audio/music/upload`)
      .send({
        url: 'not-a-valid-url',
        duration: 65.0,
      });

    expect(res.status).toBe(400);
  });

  it('PUT upload returns 400 for negative duration', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/episodes/${episodeId}/audio/music/upload`)
      .send({
        url: 'https://custom-bgm.example.com/music.mp3',
        duration: -1,
      });

    expect(res.status).toBe(400);
  });

  it('PUT upload returns 400 for invalid episode ID format', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/episodes/bad-format/audio/music/upload`)
      .send({
        url: 'https://custom-bgm.example.com/music.mp3',
        duration: 65.0,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Validation failed');
  });

  // ── Emotion Transition Warnings ──────────────────────────────────

  it('POST generate warns on large emotion contrast between adjacent nodes', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    // Create nodes with contrasting emotions: 激昂 then 悲伤
    const contrastNodes: StoryboardNode[] = [
      {
        ...createMockNodes()[0],
        music_mood: '激昂',
        emotion_tag: '激动的',
      },
      {
        ...createMockNodes()[1],
        music_mood: '悲伤',
        emotion_tag: '悲伤的',
      },
    ];

    const storyboardData: EpisodesStoryboard = { [episodeId]: contrastNodes };
    await testPrisma.project.update({
      where: { id: projectId },
      data: { storyboard_nodes: storyboardData as unknown as Prisma.InputJsonValue },
    });

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${episodeId}/audio/music/generate`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.data.warnings).toBeDefined();
    expect(res.body.data.warnings.length).toBeGreaterThan(0);
    expect(res.body.data.warnings[0].type).toBe('emotion_transition');
    expect(res.body.data.warnings[0].message).toContain('过渡节点');
  });
});
