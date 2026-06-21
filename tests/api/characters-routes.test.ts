import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import {
  cleanCharacters,
  cleanProjects,
  cleanSnapshots,
  disconnectTestDb,
  testPrisma,
} from '../helpers/prisma.js';
import { createTestApp } from '../helpers/app.js';

const app = createTestApp(testPrisma);

async function createTestProject() {
  const res = await request(app).post('/api/v1/projects').send({
    meta: {
      title: '角色测试项目',
      description: '用于测试角色圣经模块',
      genre: 'urban_romance',
      style_tags: ['realistic'],
    },
  });
  return res.body.data;
}

function createCharacterPayload(name: string, overrides: Record<string, unknown> = {}) {
  return {
    name,
    role_type: 'protagonist',
    appearance: 'long black hair',
    costume: 'red dress',
    ...overrides,
  };
}

describe('characters API routes', () => {
  beforeEach(async () => {
    await cleanProjects();
    await cleanSnapshots();
    await cleanCharacters();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('POST /api/v1/projects/:projectId/characters creates a character', async () => {
    const project = await createTestProject();
    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/characters`)
      .send(createCharacterPayload('Alice'));

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Alice');
    expect(res.body.data.role_type).toBe('protagonist');
    expect(res.body.data.status).toBe('draft');
  });

  it('GET /api/v1/projects/:projectId/characters lists characters', async () => {
    const project = await createTestProject();
    await request(app)
      .post(`/api/v1/projects/${project.id}/characters`)
      .send(createCharacterPayload('A'));
    await request(app)
      .post(`/api/v1/projects/${project.id}/characters`)
      .send(createCharacterPayload('B', { role_type: 'supporting' }));

    const res = await request(app).get(`/api/v1/projects/${project.id}/characters`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.characters).toHaveLength(2);
  });

  it('GET /api/v1/projects/:projectId/characters/:charId returns a character', async () => {
    const project = await createTestProject();
    const created = await request(app)
      .post(`/api/v1/projects/${project.id}/characters`)
      .send(createCharacterPayload('Alice'));

    const res = await request(app).get(
      `/api/v1/projects/${project.id}/characters/${created.body.data.id}`
    );
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(created.body.data.id);
  });

  it('GET /api/v1/projects/:projectId/characters/:charId returns 404 for missing', async () => {
    const project = await createTestProject();
    const res = await request(app).get(`/api/v1/projects/${project.id}/characters/missing-id`);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Character not found');
  });

  it('PUT /api/v1/projects/:projectId/characters/:charId updates a character', async () => {
    const project = await createTestProject();
    const created = await request(app)
      .post(`/api/v1/projects/${project.id}/characters`)
      .send(createCharacterPayload('Alice'));

    const res = await request(app)
      .put(`/api/v1/projects/${project.id}/characters/${created.body.data.id}`)
      .send({ appearance: 'short red hair' });

    expect(res.status).toBe(200);
    expect(res.body.data.appearance).toBe('short red hair');
  });

  it('DELETE /api/v1/projects/:projectId/characters/:charId removes a character', async () => {
    const project = await createTestProject();
    const created = await request(app)
      .post(`/api/v1/projects/${project.id}/characters`)
      .send(createCharacterPayload('Alice'));

    const res = await request(app).delete(
      `/api/v1/projects/${project.id}/characters/${created.body.data.id}`
    );
    expect(res.status).toBe(204);

    const getRes = await request(app).get(
      `/api/v1/projects/${project.id}/characters/${created.body.data.id}`
    );
    expect(getRes.status).toBe(404);
  });

  it('POST /auto-create creates batch characters from outline', async () => {
    const project = await createTestProject();
    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/characters/auto-create`)
      .send({
        characters: [
          { name: 'Hero', role_type: 'protagonist' },
          { name: 'Villain', role_type: 'antagonist' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].name).toBe('Hero');
  });

  it('POST /generate-views generates three views', async () => {
    const project = await createTestProject();
    const created = await request(app)
      .post(`/api/v1/projects/${project.id}/characters`)
      .send(createCharacterPayload('Alice'));

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/characters/${created.body.data.id}/generate-views`)
      .send({ seed: 123 });

    expect(res.status).toBe(200);
    const refImages = res.body.data.ref_images;
    expect(refImages).toHaveLength(3);
    expect(refImages.map((i: { view: string }) => i.view).sort()).toEqual(['back', 'front', 'side']);
  });

  it('POST /generate-views/:viewId/retry regenerates one view', async () => {
    const project = await createTestProject();
    const created = await request(app)
      .post(`/api/v1/projects/${project.id}/characters`)
      .send(createCharacterPayload('Alice'));
    await request(app)
      .post(`/api/v1/projects/${project.id}/characters/${created.body.data.id}/generate-views`)
      .send({});

    const res = await request(app).post(
      `/api/v1/projects/${project.id}/characters/${created.body.data.id}/generate-views/front/retry`
    );
    expect(res.status).toBe(200);
  });

  it('POST /confirm-views confirms views and generates refs', async () => {
    const project = await createTestProject();
    const created = await request(app)
      .post(`/api/v1/projects/${project.id}/characters`)
      .send(createCharacterPayload('Alice'));
    await request(app)
      .post(`/api/v1/projects/${project.id}/characters/${created.body.data.id}/generate-views`)
      .send({});

    const res = await request(app).post(
      `/api/v1/projects/${project.id}/characters/${created.body.data.id}/confirm-views`
    );
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('confirmed');
    expect(res.body.data.ip_adapter_id).toBe(`ipadapter-${created.body.data.id}`);
    expect(res.body.data.ref_images).toHaveLength(9);
  });

  it('POST /generate-refs generates extension refs', async () => {
    const project = await createTestProject();
    const created = await request(app)
      .post(`/api/v1/projects/${project.id}/characters`)
      .send(createCharacterPayload('Alice'));
    await request(app)
      .post(`/api/v1/projects/${project.id}/characters/${created.body.data.id}/generate-views`)
      .send({});

    const res = await request(app).post(
      `/api/v1/projects/${project.id}/characters/${created.body.data.id}/generate-refs`
    );
    expect(res.status).toBe(200);
    expect(res.body.data.ref_images).toHaveLength(9);
  });

  it('POST /rollback restores a previous version', async () => {
    const project = await createTestProject();
    const created = await request(app)
      .post(`/api/v1/projects/${project.id}/characters`)
      .send(createCharacterPayload('Alice'));
    await request(app)
      .put(`/api/v1/projects/${project.id}/characters/${created.body.data.id}`)
      .send({ appearance: 'short red hair' });

    const historyRes = await request(app).get(
      `/api/v1/projects/${project.id}/entities/character/${created.body.data.id}/versions`
    );
    const versions = historyRes.body.data.versions;
    const firstVersion = versions[versions.length - 1].versionId;

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/characters/${created.body.data.id}/rollback`)
      .send({ version_id: firstVersion });

    expect(res.status).toBe(200);
    expect(res.body.data.appearance).toBe('long black hair');
  });

  it('POST /sync-from-outline creates characters from outline', async () => {
    const project = await createTestProject();
    await testPrisma.project.update({
      where: { id: project.id },
      data: {
        outline: {
          world_setting: 'Modern city',
          main_conflict: 'Love triangle',
          episode_count: 2,
          characters: [
            { name: 'Alice', role_type: 'protagonist', description: 'A brave reporter' },
            { name: 'Bob', role_type: 'supporting', description: 'Her editor' },
          ],
          locations: [],
          episodes: [
            { episode_number: 1, title: 'E1', summary: 'S1', key_events: ['e1'], featured_characters: ['Alice'], featured_locations: ['Office'] },
            { episode_number: 2, title: 'E2', summary: 'S2', key_events: ['e2'], featured_characters: ['Alice', 'Bob'], featured_locations: ['Office'] },
          ],
        } as never,
      },
    });

    const res = await request(app).post(`/api/v1/projects/${project.id}/characters/sync-from-outline`);

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].name).toBe('Alice');
    expect(res.body.data[0].episode_range).toBe('1-2');
    expect(res.body.data[1].name).toBe('Bob');
  });

  it('returns 400 for invalid role_type', async () => {
    const project = await createTestProject();
    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/characters`)
      .send({ name: 'A', role_type: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
  });

  it('returns 400 for missing name', async () => {
    const project = await createTestProject();
    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/characters`)
      .send({ role_type: 'protagonist' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
  });
});
