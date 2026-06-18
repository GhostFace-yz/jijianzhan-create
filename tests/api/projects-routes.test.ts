import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { cleanProjects, disconnectTestDb, testPrisma } from '../helpers/prisma.js';
import { createTestApp } from '../helpers/app.js';

const app = createTestApp(testPrisma);

const validProject = {
  meta: {
    title: '都市奇缘',
    description: '一段发生在现代都市的浪漫故事',
    genre: 'urban_romance',
    target_episodes: 12,
    duration_goal: '5min',
    style_tags: ['realistic', 'fresh'],
    notes: '备注',
  },
};

function createPayload(title: string, overrides: Record<string, unknown> = {}) {
  return {
    meta: {
      ...validProject.meta,
      title,
      ...overrides,
    },
  };
}

describe('projects API routes', () => {
  beforeEach(async () => {
    await cleanProjects();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('POST /api/v1/projects creates a project with draft status', async () => {
    const res = await request(app).post('/api/v1/projects').send(validProject);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.meta.title).toBe('都市奇缘');
    expect(res.body.data.user_id).toBe('system');
    expect(res.body.data.created_at).toBeDefined();
    expect(res.body.data.updated_at).toBeDefined();
  });

  it('GET /api/v1/projects returns project list', async () => {
    await request(app).post('/api/v1/projects').send(createPayload('项目 A'));
    await request(app).post('/api/v1/projects').send(createPayload('项目 B'));

    const res = await request(app).get('/api/v1/projects');

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.projects).toHaveLength(2);
  });

  it('GET /api/v1/projects filters by status', async () => {
    const created = await request(app).post('/api/v1/projects').send(createPayload('项目 A'));
    await request(app)
      .patch(`/api/v1/projects/${created.body.data.id}`)
      .send({ status: 'outlining' });
    await request(app).post('/api/v1/projects').send(createPayload('项目 B'));

    const res = await request(app).get('/api/v1/projects?status=outlining');

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.projects[0].status).toBe('outlining');
  });

  it('GET /api/v1/projects searches by title keyword', async () => {
    await request(app).post('/api/v1/projects').send(createPayload('都市奇缘'));
    await request(app).post('/api/v1/projects').send(createPayload('古装风云'));

    const res = await request(app).get('/api/v1/projects?search=都市');

    expect(res.status).toBe(200);
    expect(res.body.data.projects).toHaveLength(1);
    expect(res.body.data.projects[0].meta.title).toBe('都市奇缘');
  });

  it('GET /api/v1/projects sorts by updated_at', async () => {
    const first = await request(app).post('/api/v1/projects').send(createPayload('最早'));
    await request(app).post('/api/v1/projects').send(createPayload('最晚'));
    await new Promise((resolve) => setTimeout(resolve, 10));
    await request(app).patch(`/api/v1/projects/${first.body.data.id}`).send({ meta: { notes: 'updated' } });

    const ascRes = await request(app).get('/api/v1/projects?sort=updated_at_asc');
    expect(ascRes.body.data.projects[0].meta.title).toBe('最晚');

    const descRes = await request(app).get('/api/v1/projects?sort=updated_at_desc');
    expect(descRes.body.data.projects[0].meta.title).toBe('最早');
  });

  it('GET /api/v1/projects/:id returns a project', async () => {
    const created = await request(app).post('/api/v1/projects').send(validProject);

    const res = await request(app).get(`/api/v1/projects/${created.body.data.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(created.body.data.id);
  });

  it('GET /api/v1/projects/:id returns 404 for missing project', async () => {
    const res = await request(app).get('/api/v1/projects/non-existent');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Project not found');
  });

  it('PATCH /api/v1/projects/:id updates project meta and status', async () => {
    const created = await request(app).post('/api/v1/projects').send(validProject);

    const res = await request(app).patch(`/api/v1/projects/${created.body.data.id}`).send({
      meta: { title: '新标题' },
      status: 'producing',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.meta.title).toBe('新标题');
    expect(res.body.data.status).toBe('producing');
  });

  it('DELETE /api/v1/projects/:id removes a project', async () => {
    const created = await request(app).post('/api/v1/projects').send(validProject);

    const res = await request(app).delete(`/api/v1/projects/${created.body.data.id}`);

    expect(res.status).toBe(204);

    const getRes = await request(app).get(`/api/v1/projects/${created.body.data.id}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 400 for missing required meta fields', async () => {
    const res = await request(app).post('/api/v1/projects').send({
      meta: { title: '' },
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
  });

  it('returns 400 for title exceeding 50 characters', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .send(createPayload('a'.repeat(51)));

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
  });

  it('returns 400 for target_episodes out of range', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .send(createPayload('项目', { target_episodes: 101 }));

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
  });

  it('allows creating project without optional fields', async () => {
    const res = await request(app).post('/api/v1/projects').send({
      meta: {
        title: '极简项目',
        description: '无可选字段',
        genre: 'other',
        style_tags: [],
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.data.meta.title).toBe('极简项目');
    expect(res.body.data.meta.target_episodes).toBeUndefined();
    expect(res.body.data.meta.duration_goal).toBeUndefined();
  });
});
