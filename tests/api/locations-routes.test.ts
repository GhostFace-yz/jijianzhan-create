import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import {
  cleanProjects,
  cleanSnapshots,
  disconnectTestDb,
  testPrisma,
} from '../helpers/prisma.js';
import { createTestApp } from '../helpers/app.js';
import { createSceneBibleService } from '../../src/server/services/scene-bible/scene-bible-service.js';
import { createSnapshotService } from '../../src/server/services/snapshot/snapshot-service.js';
import { AdapterPool } from '../../src/server/adapters/pool.js';
import { MockImageAdapter } from '../../src/server/adapters/providers/mock/mock-image-adapter.js';

const app = createTestApp(testPrisma);

function createTestService() {
  const adapterPool = new AdapterPool();
  adapterPool.registerImage(new MockImageAdapter());
  const snapshotService = createSnapshotService({ prisma: testPrisma });
  return createSceneBibleService({
    prisma: testPrisma,
    snapshotService,
    adapterPool,
  });
}

async function createTestProject(meta: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/v1/projects')
    .send({
      meta: {
        title: 'Scene Test',
        description: 'Test project for scene bible',
        genre: 'urban_romance',
        ...meta,
      },
    });
  return res.body.data;
}

async function createTestLocation(
  projectId: string,
  overrides: Record<string, unknown> = {}
) {
  const service = createTestService();
  return service.createScene(projectId, {
    name: 'Cafe',
    ...overrides,
  });
}

describe('locations API routes', () => {
  beforeEach(async () => {
    await cleanProjects();
    await cleanSnapshots();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('GET / lists scenes', async () => {
    const project = await createTestProject();
    await createTestLocation(project.id, { name: 'Cafe' });
    await createTestLocation(project.id, { name: 'Park' });

    const res = await request(app).get(`/api/v1/projects/${project.id}/locations`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.locations.map((l: { name: string }) => l.name).sort()).toEqual([
      'Cafe',
      'Park',
    ]);
  });

  it('PUT /:locId updates scene fields', async () => {
    const project = await createTestProject();
    const location = await createTestLocation(project.id);

    const res = await request(app)
      .put(`/api/v1/projects/${project.id}/locations/${location.id}`)
      .send({
        description: 'A cozy coffee shop',
        lighting_type: 'warm ambient',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('A cozy coffee shop');
    expect(res.body.data.lighting_type).toBe('warm ambient');
  });

  it('POST /:locId/generate-base returns 3 candidates', async () => {
    const project = await createTestProject();
    const location = await createTestLocation(project.id, {
      description: 'A cozy coffee shop',
      lighting_type: 'warm',
      style: 'vintage',
    });

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/locations/${location.id}/generate-base`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0]).toHaveProperty('url');
    expect(res.body.data[0]).toHaveProperty('seed');
    expect(res.body.data[0]).toHaveProperty('prompt');
  });

  it('POST /:locId/confirm-base persists base image', async () => {
    const project = await createTestProject();
    const location = await createTestLocation(project.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/locations/${location.id}/confirm-base`)
      .send({
        candidate: {
          url: 'https://example.com/base.png',
          seed: 12345,
          prompt: 'base prompt',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.base_seed).toBe(12345);
    expect(res.body.data.base_image_url).toBe('https://example.com/base.png');
  });

  it('POST /:locId/generate-variant returns deterministic seed', async () => {
    const project = await createTestProject();
    const location = await createTestLocation(project.id);
    await request(app)
      .post(`/api/v1/projects/${project.id}/locations/${location.id}/confirm-base`)
      .send({
        candidate: {
          url: 'https://example.com/base.png',
          seed: 1000,
          prompt: 'base',
        },
      });

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/locations/${location.id}/generate-variant`)
      .send({ time_of_day: 'morning', weather: 'rainy' });

    expect(res.status).toBe(200);
    expect(res.body.data.seed).toBeDefined();
    expect(res.body.data.prompt).toContain('morning');
    expect(res.body.data.prompt).toContain('rainy');
  });

  it('POST /:locId/confirm-variant persists variant', async () => {
    const project = await createTestProject();
    const location = await createTestLocation(project.id);
    await request(app)
      .post(`/api/v1/projects/${project.id}/locations/${location.id}/confirm-base`)
      .send({
        candidate: {
          url: 'https://example.com/base.png',
          seed: 1000,
          prompt: 'base',
        },
      });

    const variantRes = await request(app)
      .post(`/api/v1/projects/${project.id}/locations/${location.id}/generate-variant`)
      .send({ time_of_day: 'night', weather: 'clear' });

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/locations/${location.id}/confirm-variant`)
      .send({
        time_of_day: 'night',
        weather: 'clear',
        variant: variantRes.body.data,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.variants['night-clear'].seed).toBe(variantRes.body.data.seed);
  });

  it('GET /:locId/versions returns history', async () => {
    const project = await createTestProject();
    const location = await createTestLocation(project.id);

    const res = await request(app).get(
      `/api/v1/projects/${project.id}/locations/${location.id}/versions`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('POST /:locId/rollback restores previous version', async () => {
    const project = await createTestProject();
    const location = await createTestLocation(project.id);
    await request(app)
      .put(`/api/v1/projects/${project.id}/locations/${location.id}`)
      .send({ description: 'Updated' });

    const historyRes = await request(app).get(
      `/api/v1/projects/${project.id}/locations/${location.id}/versions`
    );
    const firstVersion = historyRes.body.data.versions[historyRes.body.data.versions.length - 1];

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/locations/${location.id}/rollback`)
      .send({ version_id: firstVersion.versionId });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBeNull();
  });

  it('returns 500 when location not found on update', async () => {
    const project = await createTestProject();
    const res = await request(app)
      .put(`/api/v1/projects/${project.id}/locations/non-existent-id`)
      .send({ description: 'X' });

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Location not found');
  });

  it('returns 400 for invalid body', async () => {
    const project = await createTestProject();
    const location = await createTestLocation(project.id);

    const res = await request(app)
      .post(`/api/v1/projects/${project.id}/locations/${location.id}/confirm-base`)
      .send({ candidate: { url: 'not-a-url', seed: 'not-a-number' } });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
  });
});
