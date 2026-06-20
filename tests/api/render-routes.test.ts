import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { cleanProjects, cleanSnapshots, disconnectTestDb, testPrisma } from '../helpers/prisma.js';
import { createTestApp } from '../helpers/app.js';
import type { StoryboardNode, EpisodesStoryboard } from '../../src/server/services/storyboard/types.js';
import type { EpisodeMusic, ProjectMusic } from '../../src/server/services/music/types.js';

const app = createTestApp(testPrisma);

const validProject = {
  meta: {
    title: '测试短剧',
    description: '测试合成功能',
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
    {
      node_id: 'ep01-n002',
      scene_id: 's1',
      scene_variant: '傍晚-晴',
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
      status: 'completed',
      version_history: [],
      video_clip: {
        url: 'https://mock-cdn.example.com/video/2.mp4',
        duration: 5,
        camera_move: 'none',
        motion_description: 'static shot',
        generated_at: new Date().toISOString(),
        status: 'generated',
        quality_report: {
          actual_duration: 5,
          target_duration: 5,
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
    {
      node_id: 'ep01-n003',
      scene_id: 's2',
      scene_variant: '夜晚',
      characters: [],
      shot_type: 'wide-shot',
      camera_move: 'static',
      visual_desc: '夜晚的街道',
      dialogue: { char_id: '配角', text: '再见', emotion: '平静的' },
      emotion_tag: '平静的',
      music_mood: '舒缓',
      duration_target: 4,
      transition_in: 'fade',
      transition_out: 'cut',
      status: 'completed',
      version_history: [],
      audio_clip: {
        url: 'https://mock-cdn.example.com/tts/3.mp3',
        duration: 5.0,
        voice_id: 'voice-2',
        emotion: 'neutral',
        speed: 1,
        generated_at: new Date().toISOString(),
        status: 'generated',
      },
      video_clip: {
        url: 'https://mock-cdn.example.com/video/3.mp4',
        duration: 4,
        camera_move: 'none',
        motion_description: 'static shot',
        generated_at: new Date().toISOString(),
        status: 'generated',
        quality_report: {
          actual_duration: 4,
          target_duration: 4,
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
  const createRes = await request(app).post('/api/v1/projects').send(validProject);
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
        crossfade_out: 0.4,
      },
      {
        node_id: 'ep01-n002',
        start_time: 5.6,
        duration: 5.8,
        url: 'https://mock-cdn.example.com/music/ep1.mp3',
        volume: 0.9,
        ducked: false,
        crossfade_in: 0.4,
        crossfade_out: 0.4,
      },
      {
        node_id: 'ep01-n003',
        start_time: 10.8,
        duration: 4.6,
        url: 'https://mock-cdn.example.com/music/ep1.mp3',
        volume: 0.25,
        ducked: true,
        crossfade_in: 0.4,
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

describe('render API routes', () => {
  beforeEach(async () => {
    await cleanProjects();
    await cleanSnapshots();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  // ── POST /render ──────────────────────────────────────────────────

  it('POST /render returns 201 and starts composition', async () => {
    const projectId = await createProjectWithRenderedAssets();

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${episodeId}/render`)
      .send({ resolution: '1080x1920', fps: 30 });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.episode_id).toBe(episodeId);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.progress_percent).toBe(100);
    expect(res.body.data.output_url).toBeTruthy();
    expect(res.body.data.output_duration).toBeGreaterThan(0);
    expect(res.body.data.resolution).toBe('1080x1920');
    expect(res.body.data.fps).toBe(30);
    expect(res.body.data.subtitle_cues).toBeInstanceOf(Array);
    expect(res.body.data.transitions).toBeInstanceOf(Array);
    expect(res.body.data.started_at).toBeTruthy();
    expect(res.body.data.completed_at).toBeTruthy();
  });

  it('POST /render applies correct transitions', async () => {
    const projectId = await createProjectWithRenderedAssets();

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${episodeId}/render`)
      .send({});

    const transitions = res.body.data.transitions as Array<{
      from_node_id: string;
      to_node_id: string;
      transition_type: string;
      duration: number;
    }>;

    // n1 and n2: same scene, different variant → dissolve 0.3s
    const t1 = transitions.find((t) => t.from_node_id === 'ep01-n001' && t.to_node_id === 'ep01-n002');
    expect(t1).toBeDefined();
    expect(t1!.transition_type).toBe('dissolve');
    expect(t1!.duration).toBe(0.3);

    // n2 and n3: different scenes → fade 0.5s
    const t2 = transitions.find((t) => t.from_node_id === 'ep01-n002' && t.to_node_id === 'ep01-n003');
    expect(t2).toBeDefined();
    expect(t2!.transition_type).toBe('fade');
    expect(t2!.duration).toBe(0.5);
  });

  it('POST /render handles freeze-extend when TTS exceeds video duration', async () => {
    const projectId = await createProjectWithRenderedAssets();

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${episodeId}/render`)
      .send({});

    // n3: video 4s, TTS 5s → total duration should include freeze extend
    expect(res.body.data.output_duration).toBeGreaterThanOrEqual(15);
  });

  it('POST /render returns 400 when video clips are missing', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const nodes = createMockNodes().map((node) => ({ ...node, video_clip: undefined }));
    const storyboardData: EpisodesStoryboard = { [episodeId]: nodes as unknown as StoryboardNode[] };

    const episodeMusic: EpisodeMusic = {
      original_url: 'https://mock-cdn.example.com/music/ep1.mp3',
      duration: 15,
      segments: [],
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

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${episodeId}/render`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Video clips have not been generated');
  });

  it('POST /render returns 400 when music is missing', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const nodes = createMockNodes();
    const storyboardData: EpisodesStoryboard = { [episodeId]: nodes };

    await testPrisma.projects.update({
      where: { id: projectId },
      data: { storyboard_nodes: storyboardData as unknown as Prisma.InputJsonValue },
    });

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${episodeId}/render`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Music has not been generated');
  });

  it('POST /render returns 400 for invalid episode ID format', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/bad-format/render`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Validation failed');
  });

  it('POST /render accepts custom music duck values', async () => {
    const projectId = await createProjectWithRenderedAssets();

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${episodeId}/render`)
      .send({ music_duck_dialogue: 0.25, music_duck_nondialogue: 0.85 });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('completed');
  });

  // ── GET /render/progress ──────────────────────────────────────────

  it('GET /render/progress returns current render output', async () => {
    const projectId = await createProjectWithRenderedAssets();

    await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${episodeId}/render`)
      .send({});

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/episodes/${episodeId}/render/progress`);

    expect(res.status).toBe(200);
    expect(res.body.data.episode_id).toBe(episodeId);
    expect(res.body.data.status).toBe('completed');
  });

  it('GET /render/progress returns 404 when no render exists', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/episodes/${episodeId}/render/progress`);

    expect(res.status).toBe(404);
  });

  // ── GET /render/download ──────────────────────────────────────────

  it('GET /render/download returns URL when render completed', async () => {
    const projectId = await createProjectWithRenderedAssets();

    await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${episodeId}/render`)
      .send({});

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/episodes/${episodeId}/render/download`);

    expect(res.status).toBe(200);
    expect(res.body.data.url).toBeTruthy();
    expect(res.body.data.url).toContain('.mp4');
  });

  it('GET /render/download returns 404 when render not completed', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/episodes/${episodeId}/render/download`);

    expect(res.status).toBe(404);
  });

  // ── Re-render ─────────────────────────────────────────────────────

  it('POST /render overwrites previous render output', async () => {
    const projectId = await createProjectWithRenderedAssets();

    const first = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${episodeId}/render`)
      .send({});
    const firstUrl = first.body.data.output_url;

    const second = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${episodeId}/render`)
      .send({ resolution: '1920x1080' });

    expect(second.body.data.output_url).not.toBe(firstUrl);
    expect(second.body.data.resolution).toBe('1920x1080');
  });

  // ── Snapshot ──────────────────────────────────────────────────────

  it('POST /render creates a version snapshot', async () => {
    const projectId = await createProjectWithRenderedAssets();

    await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${episodeId}/render`)
      .send({});

    const snapshots = await testPrisma.version_snapshots.findMany({
      where: {
        project_id: projectId,
        entity_type: 'generation_result',
        source: 'ai_generated',
      },
    });

    expect(snapshots.length).toBeGreaterThan(0);
  });
});
