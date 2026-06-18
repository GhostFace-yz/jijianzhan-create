import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { cleanSnapshots, disconnectTestDb, testPrisma } from '../helpers/prisma.js';
import { createTestApp } from '../helpers/app.js';

const app = createTestApp(testPrisma);

describe('snapshot API routes', () => {
  beforeEach(async () => {
    await cleanSnapshots();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const baseUrl = '/api/v1/projects/project-1/entities/outline/outline-1/versions';

  it('POST /versions creates a snapshot', async () => {
    const res = await request(app)
      .post(baseUrl)
      .send({ source: 'user_edited', content: { title: 'Outline' } });

    expect(res.status).toBe(201);
    expect(res.body.data.versionId).toBe('v1');
    expect(res.body.data.source).toBe('user_edited');
  });

  it('GET /versions returns history', async () => {
    await request(app)
      .post(baseUrl)
      .send({ source: 'user_edited', content: { v: 1 } });
    await request(app)
      .post(baseUrl)
      .send({ source: 'ai_generated', content: { v: 2 }, ai_model: { provider: 'openai', model: 'gpt-4o' } });

    const res = await request(app).get(baseUrl);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.versions.map((v: { versionId: string }) => v.versionId)).toEqual(['v2', 'v1']);
  });

  it('GET /versions/:versionId returns a snapshot', async () => {
    await request(app).post(baseUrl).send({ source: 'user_edited', content: { v: 1 } });

    const res = await request(app).get(`${baseUrl}/v1`);

    expect(res.status).toBe(200);
    expect(res.body.data.versionId).toBe('v1');
    expect(res.body.data.content).toEqual({ v: 1 });
  });

  it('GET /versions/compare returns diff between two versions', async () => {
    await request(app).post(baseUrl).send({ source: 'user_edited', content: { title: 'A' } });
    await request(app).post(baseUrl).send({ source: 'user_edited', content: { title: 'B', extra: true } });

    const res = await request(app).get(`${baseUrl}/compare?from=v1&to=v2`);

    expect(res.status).toBe(200);
    expect(res.body.data.fromVersionId).toBe('v1');
    expect(res.body.data.toVersionId).toBe('v2');
    expect(res.body.data.diff).toEqual({ title: 'changed', extra: 'added' });
  });

  it('POST /versions/:versionId/rollback rolls back and creates a new version', async () => {
    await request(app).post(baseUrl).send({ source: 'user_edited', content: { v: 1 } });
    await request(app).post(baseUrl).send({ source: 'user_edited', content: { v: 2 } });

    const res = await request(app)
      .post(`${baseUrl}/v1/rollback`)
      .send({ edited_by: 'user-1' });

    expect(res.status).toBe(201);
    expect(res.body.data.versionId).toBe('v3');
    expect(res.body.data.content).toEqual({ v: 1 });
    expect(res.body.data.source).toBe('user_edited');
  });

  it('POST /versions/:versionId/rollback marks downstream nodes as pending review', async () => {
    await request(app).post(baseUrl).send({ source: 'user_edited', content: { v: 1 } });
    await request(app).post(baseUrl).send({ source: 'user_edited', content: { v: 2 } });

    const res = await request(app)
      .post(`${baseUrl}/v1/rollback`)
      .send({ edited_by: 'user-1' });

    expect(res.status).toBe(201);

    const flags = await testPrisma.downstreamReviewFlag.findMany({
      where: {
        project_id: 'project-1',
        source_entity_type: 'outline',
        source_entity_id: 'outline-1',
      },
    });

    expect(flags).toHaveLength(1);
    expect(flags[0].source_version_id).toBe('v1');
    expect(flags[0].new_version_id).toBe(res.body.data.versionId);
    expect(flags[0].status).toBe('pending_review');
  });

  it('returns 404 for a missing version', async () => {
    const res = await request(app).get(`${baseUrl}/v99`);

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Version not found');
  });

  it('returns 400 for invalid source enum', async () => {
    const res = await request(app)
      .post(baseUrl)
      .send({ source: 'invalid', content: {} });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
  });
});
