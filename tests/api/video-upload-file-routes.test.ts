import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const uploadTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-upload-test-'));
process.env.RENDER_OUTPUT_DIR = uploadTempDir;
process.env.RENDER_OUTPUT_URL = 'file://';

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

/**
 * Create a project and generate/confirm outline.
 */
async function createProjectAndOutline() {
  const createRes = await request(app).post('/api/v1/projects').send(validProject);
  const projectId = createRes.body.data.id;
  const genRes = await request(app).post(`/api/v1/projects/${projectId}/outline/generate`);
  await request(app).post(`/api/v1/projects/${projectId}/outline/confirm`);
  return { projectId, outline: genRes.body.data };
}

/**
 * Create a project with storyboard nodes that have image_url set.
 */
async function createProjectWithStoryboardNodes(episodeNumber = 1) {
  const { projectId, outline } = await createProjectAndOutline();
  const epId = `ep-${episodeNumber}`;

  const mockScript = {
    episode_title: `第${episodeNumber}集`,
    scenes: [
      {
        scene_id: 's1',
        location_id: 'loc-1',
        time_of_day: '下午',
        weather: '晴天',
        characters_present: ['主角', '重要配角'],
        scene_summary: '主角在咖啡厅与重要配角相遇，两人展开对话',
        beats: ['主角进入咖啡厅', '与配角相遇', '展开关键对话', '离开咖啡厅'],
        dialogues: [
          { char_id: '主角', text: '好久不见，最近过得怎么样？', emotion: 'happy' },
          { char_id: '重要配角', text: '还不错，只是工作有些忙碌。', emotion: 'neutral' },
        ],
      },
      {
        scene_id: 's2',
        location_id: 'loc-2',
        time_of_day: '傍晚',
        weather: '多云',
        characters_present: ['主角'],
        scene_summary: '主角独自在河边散步，思考人生方向',
        beats: ['走到河边', '望着夕阳沉思', '下定决心', '转身离开'],
        dialogues: [{ char_id: '主角', text: '我不能再这样下去了。', emotion: 'contemplative' }],
      },
    ],
    end_state: { characters: [], unresolved_conflicts: [], key_prop_states: {} },
  };

  const project = await testPrisma.project.findUnique({ where: { id: projectId } });
  const meta = (project?.meta as Record<string, unknown>) || {};
  const updatedMeta = { ...meta, [`script_${epId}`]: mockScript };
  await testPrisma.project.update({
    where: { id: projectId },
    data: { meta: updatedMeta as any },
  });

  const splitRes = await request(app).post(
    `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`,
  );

  const nodesWithImages = splitRes.body.data.nodes.map((node: Record<string, unknown>) => ({
    ...node,
    image_url: `https://mock-cdn.example.com/storyboard/${node.node_id}.png`,
  }));

  await request(app)
    .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`)
    .send({ nodes: nodesWithImages });

  return { projectId, epId, nodes: nodesWithImages };
}

describe('POST /video/nodes/:nodeId/upload (multipart file upload)', () => {
  beforeEach(async () => {
    await cleanProjects();
    await cleanSnapshots();
  });

  afterAll(async () => {
    await disconnectTestDb();
    fs.rmSync(uploadTempDir, { recursive: true, force: true });
  });

  it('returns 201 with uploaded video clip when file and duration are provided', async () => {
    const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
    const nodeId = nodes[0].node_id;
    const duration = nodes[0].duration_target ?? 6;

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/upload`)
      .field('duration', duration)
      .attach('video', Buffer.from('fake video content'), 'video.mp4');

    expect(res.status).toBe(201);
    expect(res.body.data.url).toMatch(/^file:\/\//);
    expect(res.body.data.duration).toBe(duration);
    expect(res.body.data.status).toBe('generated');
    expect(res.body.data.provider).toBe('user-upload');
    expect(res.body.data.quality_report.passed).toBe(true);
  });

  it('uses node duration_target when duration field is omitted', async () => {
    const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
    const nodeId = nodes[0].node_id;
    const targetDuration = nodes[0].duration_target ?? 6;

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/upload`)
      .attach('video', Buffer.from('fake video content'), 'video.mp4');

    expect(res.status).toBe(201);
    expect(res.body.data.duration).toBe(targetDuration);
  });

  it('persists uploaded video_clip on the node', async () => {
    const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
    const nodeId = nodes[0].node_id;

    await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/upload`)
      .attach('video', Buffer.from('fake video content'), 'video.mp4');

    const getRes = await request(app).get(
      `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`,
    );
    const target = getRes.body.data.find((n: Record<string, unknown>) => n.node_id === nodeId);
    expect(target.video_clip.provider).toBe('user-upload');
    expect(target.video_clip.status).toBe('generated');
    expect(target.video_clip.url).toMatch(/^file:\/\//);
  });

  it('returns 400 when no video file is provided', async () => {
    const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
    const nodeId = nodes[0].node_id;

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/upload`)
      .field('duration', 6);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
  });

  it('returns 400 for invalid duration', async () => {
    const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
    const nodeId = nodes[0].node_id;

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/upload`)
      .field('duration', -1)
      .attach('video', Buffer.from('fake video content'), 'video.mp4');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
  });

  it('returns 404 for non-existent node', async () => {
    const { projectId, epId } = await createProjectWithStoryboardNodes();

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/ep01-n999/upload`)
      .attach('video', Buffer.from('fake video content'), 'video.mp4');

    expect(res.status).toBe(404);
  });

  it('creates a user_edited snapshot for uploaded video', async () => {
    const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
    const nodeId = nodes[0].node_id;

    await request(app)
      .post(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/upload`)
      .attach('video', Buffer.from('fake video content'), 'video.mp4');

    const snapshots = await testPrisma.versionSnapshot.findMany({
      where: {
        project_id: projectId,
        entity_type: 'node',
        entity_id: nodeId,
        source: 'user_edited',
      },
    });
    expect(snapshots.length).toBeGreaterThan(0);
  });
});
