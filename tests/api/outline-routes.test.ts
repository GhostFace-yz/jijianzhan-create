import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { cleanProjects, cleanSnapshots, disconnectTestDb, testPrisma } from '../helpers/prisma.js';
import { createTestApp } from '../helpers/app.js';

const app = createTestApp(testPrisma);

const validProject = {
  meta: {
    title: '都市奇缘',
    description: '一段发生在现代都市的浪漫爱情故事',
    genre: 'urban_romance',
    target_episodes: 6,
    duration_goal: '5min',
    style_tags: ['realistic', 'fresh'],
  },
};

async function createProjectAndGenerateOutline() {
  const createRes = await request(app).post('/api/v1/projects').send(validProject);
  const projectId = createRes.body.data.id;
  const genRes = await request(app).post(`/api/v1/projects/${projectId}/outline/generate`);
  return { projectId, outline: genRes.body.data };
}

describe('outline API routes', () => {
  beforeEach(async () => {
    await cleanProjects();
    await cleanSnapshots();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  // ── POST /generate ────────────────────────────────────────────

  it('POST /api/v1/projects/:id/outline/generate creates outline and returns 201', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const res = await request(app).post(`/api/v1/projects/${projectId}/outline/generate`);

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.world_setting).toBeTruthy();
    expect(res.body.data.main_conflict).toBeTruthy();
    expect(res.body.data.episodes).toBeInstanceOf(Array);
    expect(res.body.data.characters).toBeInstanceOf(Array);
    expect(res.body.data.locations).toBeInstanceOf(Array);
    expect(res.body.data.episode_count).toBeGreaterThanOrEqual(1);
  });

  it('POST /generate returns 500 for non-existent project', async () => {
    const res = await request(app).post('/api/v1/projects/non-existent/outline/generate');
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Project not found');
  });

  // ── GET / ─────────────────────────────────────────────────────

  it('GET /api/v1/projects/:id/outline returns the outline with summary fields', async () => {
    const { projectId, outline } = await createProjectAndGenerateOutline();

    const res = await request(app).get(`/api/v1/projects/${projectId}/outline`);

    expect(res.status).toBe(200);
    expect(res.body.data.outline).toBeDefined();
    expect(res.body.data.outline.world_setting).toBe(outline.world_setting);
    expect(res.body.data.outline.episodes.length).toBe(outline.episodes.length);
    expect(typeof res.body.data.outline_locked).toBe('boolean');
    expect(typeof res.body.data.project_status).toBe('string');
  });

  it('GET / returns outline null when no outline exists', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const res = await request(app).get(`/api/v1/projects/${projectId}/outline`);

    expect(res.status).toBe(200);
    expect(res.body.data.outline).toBeNull();
    expect(res.body.data.outline_locked).toBe(false);
    expect(res.body.data.project_status).toBe('draft');
  });

  // ── PUT / ─────────────────────────────────────────────────────

  it('PUT /api/v1/projects/:id/outline updates outline fields', async () => {
    const { projectId } = await createProjectAndGenerateOutline();

    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/outline`)
      .send({ world_setting: 'An updated futuristic city.' });

    expect(res.status).toBe(200);
    expect(res.body.data.world_setting).toBe('An updated futuristic city.');
    expect(res.body.data.main_conflict).toBeTruthy(); // other fields preserved
  });

  it('PUT / returns 400 for invalid update body', async () => {
    const { projectId } = await createProjectAndGenerateOutline();

    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/outline`)
      .send({ episodes: [{ episode_number: 1 }] }); // missing required fields

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
  });

  // ── POST /episodes/:n/regenerate ──────────────────────────────

  it('POST /episodes/:n/regenerate regenerates a single episode', async () => {
    const { projectId } = await createProjectAndGenerateOutline();

    const res = await request(app).post(
      `/api/v1/projects/${projectId}/outline/episodes/2/regenerate`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.episode).toBeDefined();
    expect(res.body.data.episode.episode_number).toBe(2);
    expect(res.body.data.episode_number).toBe(2);
  });

  it('POST /episodes/:n/regenerate rejects invalid episode number', async () => {
    const { projectId } = await createProjectAndGenerateOutline();

    const res = await request(app).post(
      `/api/v1/projects/${projectId}/outline/episodes/abc/regenerate`
    );

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid episode number');
  });

  // ── POST /validate ────────────────────────────────────────────

  it('POST /api/v1/projects/:id/outline/validate returns validation report', async () => {
    const { projectId } = await createProjectAndGenerateOutline();

    const res = await request(app).post(`/api/v1/projects/${projectId}/outline/validate`);

    expect(res.status).toBe(200);
    expect(res.body.data.errors).toBeInstanceOf(Array);
    expect(res.body.data.warnings).toBeInstanceOf(Array);
    expect(res.body.data.passes).toBeInstanceOf(Array);
    expect(typeof res.body.data.passed).toBe('boolean');
  });

  // ── POST /confirm ─────────────────────────────────────────────

  it('POST /api/v1/projects/:id/outline/confirm locks outline and changes status', async () => {
    const { projectId } = await createProjectAndGenerateOutline();

    const res = await request(app).post(`/api/v1/projects/${projectId}/outline/confirm`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();

    // Verify project status
    const projRes = await request(app).get(`/api/v1/projects/${projectId}`);
    expect(projRes.body.data.status).toBe('asset_prep');
    expect(projRes.body.data.outline_locked).toBe(true);
  });

  it('POST /confirm returns 500 when no outline exists', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const res = await request(app).post(`/api/v1/projects/${projectId}/outline/confirm`);

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('No outline to confirm');
  });
});
