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

  it('POST /generate auto-syncs outline characters to character bible', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const outlineRes = await request(app).post(`/api/v1/projects/${projectId}/outline/generate`);
    const outlineCharacters = outlineRes.body.data.characters as Array<{ name: string }>;

    const charactersRes = await request(app).get(`/api/v1/projects/${projectId}/characters`);
    expect(charactersRes.status).toBe(200);
    expect(charactersRes.body.data.total).toBe(outlineCharacters.length);
    expect(charactersRes.body.data.characters).toHaveLength(outlineCharacters.length);
    for (const oc of outlineCharacters) {
      expect(charactersRes.body.data.characters.some((c: { name: string }) => c.name === oc.name)).toBe(true);
    }
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

  it('POST /confirm auto-syncs outline locations to scene bible', async () => {
    const { projectId, outline } = await createProjectAndGenerateOutline();

    const res = await request(app).post(`/api/v1/projects/${projectId}/outline/confirm`);

    expect(res.status).toBe(200);

    const locationsRes = await request(app).get(`/api/v1/projects/${projectId}/locations`);
    expect(locationsRes.status).toBe(200);
    expect(locationsRes.body.data.total).toBe(outline.locations.length);
    for (const outlineLoc of outline.locations) {
      expect(
        locationsRes.body.data.locations.some((l: { name: string }) => l.name === outlineLoc.name)
      ).toBe(true);
    }
  });

  it('POST /confirm syncs enriched location fields to scene bible', async () => {
    const { projectId } = await createProjectAndGenerateOutline();

    const enrichedLocations = [
      {
        name: '主要场景',
        description: 'Updated description',
        space_type: 'indoor',
        frequency: 'main',
        style: 'modern',
        color_tone: 'blue',
        lighting_type: 'neon',
        key_props: ['desk', 'lamp'],
      },
    ];

    const updateRes = await request(app)
      .put(`/api/v1/projects/${projectId}/outline`)
      .send({ locations: enrichedLocations });
    expect(updateRes.status).toBe(200);

    const confirmRes = await request(app).post(`/api/v1/projects/${projectId}/outline/confirm`);
    expect(confirmRes.status).toBe(200);

    const locationsRes = await request(app).get(`/api/v1/projects/${projectId}/locations`);
    expect(locationsRes.status).toBe(200);
    expect(locationsRes.body.data.total).toBe(1);

    const synced = locationsRes.body.data.locations[0];
    expect(synced.name).toBe('主要场景');
    expect(synced.space_type).toBe('indoor');
    expect(synced.frequency).toBe('main');
    expect(synced.style).toBe('modern');
    expect(synced.color_tone).toBe('blue');
    expect(synced.lighting_type).toBe('neon');
    expect(synced.key_props).toEqual(['desk', 'lamp']);
  });

  it('POST /confirm returns 500 when no outline exists', async () => {
    const createRes = await request(app).post('/api/v1/projects').send(validProject);
    const projectId = createRes.body.data.id;

    const res = await request(app).post(`/api/v1/projects/${projectId}/outline/confirm`);

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('No outline to confirm');
  });
});