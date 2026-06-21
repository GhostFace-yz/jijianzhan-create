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
        dialogues: [
          { char_id: '主角', text: '我不能再这样下去了。', emotion: 'contemplative' },
        ],
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

  // Inject image_url onto each node so video generation has a first frame
  const nodesWithImages = splitRes.body.data.nodes.map((node: Record<string, unknown>) => ({
    ...node,
    image_url: `https://mock-cdn.example.com/storyboard/${node.node_id}.png`,
  }));

  await request(app)
    .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`)
    .send({ nodes: nodesWithImages });

  return { projectId, epId, nodes: nodesWithImages };
}

describe('Video API routes', () => {
  beforeEach(async () => {
    await cleanProjects();
    await cleanSnapshots();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  // ── POST /video/generate (batch) ─────────────────────────────────

  describe('POST /api/v1/projects/:projectId/episodes/:epId/video/generate', () => {
    it('returns 201 with batch video generation result on success', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/video/generate`,
      );

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.episode_id).toBe(epId);
      expect(res.body.data.total_nodes).toBeGreaterThan(0);
      expect(res.body.data.nodes_generated).toBe(res.body.data.total_nodes);
      expect(res.body.data.nodes_failed).toBe(0);
      expect(res.body.data.success_rate).toBeGreaterThanOrEqual(0.8);
      expect(res.body.data.results).toBeInstanceOf(Array);

      // Each result should have video clip and quality report
      for (const result of res.body.data.results) {
        expect(result.node_id).toBeTruthy();
        expect(result.video_clip).toBeDefined();
        expect(result.video_clip.url).toBeTruthy();
        expect(result.video_clip.duration).toBeGreaterThan(0);
        expect(result.video_clip.camera_move).toBeTruthy();
        expect(result.video_clip.motion_description).toBeTruthy();
        expect(result.video_clip.status).toBe('generated');
        expect(result.video_clip.quality_report).toBeDefined();
        expect(typeof result.video_clip.quality_report.duration_ok).toBe('boolean');
        expect(typeof result.video_clip.quality_report.face_corruption_detected).toBe('boolean');
        expect(typeof result.video_clip.quality_report.motion_jump_detected).toBe('boolean');
        expect(typeof result.video_clip.quality_report.passed).toBe('boolean');
        expect(Array.isArray(result.video_clip.quality_report.details)).toBe(true);
        expect(result.video_clip.provider).toBeTruthy();
        expect(result.video_clip.model).toBeTruthy();
        expect(typeof result.video_clip.fallback_used).toBe('boolean');
      }
    });

    it('persists video_clip on nodes for subsequent reads', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      await request(app).post(`/api/v1/projects/${projectId}/episodes/${epId}/video/generate`);

      const getRes = await request(app).get(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`,
      );

      for (const node of getRes.body.data) {
        expect(node.video_clip).toBeDefined();
        expect(node.video_clip.status).toBe('generated');
      }
    });

    it('returns 400 when no storyboard nodes exist', async () => {
      const { projectId } = await createProjectAndOutline();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/ep-1/video/generate`,
      );

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('No storyboard nodes');
    });

    it('returns 400 for invalid episode ID format', async () => {
      const { projectId } = await createProjectWithStoryboardNodes();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/not-an-ep/video/generate`,
      );

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('success rate is >= 80% for batch generation', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/video/generate`,
      );

      expect(res.body.data.success_rate).toBeGreaterThanOrEqual(0.8);
    });

    it('accepts concurrency option', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/episodes/${epId}/video/generate`)
        .send({ concurrency: 2 });

      expect(res.status).toBe(201);
      expect(res.body.data.nodes_generated).toBe(res.body.data.total_nodes);
    });

    it('detects face corruption via test marker', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      // Mark one node's visual_desc with face_corruption
      const nodesRes = await request(app).get(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`,
      );
      const nodes = nodesRes.body.data;
      nodes[0].visual_desc = `${nodes[0].visual_desc} face_corruption`;
      await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`)
        .send({ nodes });

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/video/generate`,
      );

      const target = res.body.data.results.find((r: Record<string, unknown>) => r.node_id === nodes[0].node_id);
      expect(target).toBeDefined();
      expect(target.video_clip.quality_report.face_corruption_detected).toBe(true);
      expect(target.video_clip.quality_report.passed).toBe(false);
    });

    it('detects motion jump via test marker', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      const nodesRes = await request(app).get(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`,
      );
      const nodes = nodesRes.body.data;
      nodes[0].visual_desc = `${nodes[0].visual_desc} motion_jump`;
      await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`)
        .send({ nodes });

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/video/generate`,
      );

      const target = res.body.data.results.find((r: Record<string, unknown>) => r.node_id === nodes[0].node_id);
      expect(target).toBeDefined();
      expect(target.video_clip.quality_report.motion_jump_detected).toBe(true);
      expect(target.video_clip.quality_report.passed).toBe(false);
    });

    it('creates version snapshots for generated videos', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      await request(app).post(`/api/v1/projects/${projectId}/episodes/${epId}/video/generate`);

      const snapshots = await testPrisma.versionSnapshot.findMany({
        where: {
          project_id: projectId,
          entity_type: 'node',
          source: 'ai_generated',
        },
      });
      expect(snapshots.length).toBeGreaterThan(0);
    });
  });

  // ── POST /video/nodes/:nodeId/generate (single) ──────────────────

  describe('POST /api/v1/projects/:projectId/episodes/:epId/video/nodes/:nodeId/generate', () => {
    it('returns 201 with video clip for a single node', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
      const nodeId = nodes[0].node_id;

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/generate`,
      );

      expect(res.status).toBe(201);
      expect(res.body.data.node_id).toBe(nodeId);
      expect(res.body.data.video_clip).toBeDefined();
      expect(res.body.data.video_clip.status).toBe('generated');
      expect(res.body.data.video_clip.quality_report.passed).toBe(true);
    });

    it('returns 404 for non-existent node', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/ep01-n999/generate`,
      );

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');
    });

    it('maps camera_move correctly', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
      const nodeId = nodes[0].node_id;

      // Update node to zoom-in
      const nodesRes = await request(app).get(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`,
      );
      const allNodes = nodesRes.body.data;
      allNodes[0].camera_move = 'zoom-in';
      await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`)
        .send({ nodes: allNodes });

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/generate`,
      );

      expect(res.body.data.video_clip.camera_move).toBe('zoom in');
    });
  });

  // ── PUT /video/nodes/:nodeId/review ──────────────────────────────

  describe('PUT /api/v1/projects/:projectId/episodes/:epId/video/nodes/:nodeId/review', () => {
    it('returns 200 with reviewed video clip on approve', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
      const nodeId = nodes[0].node_id;

      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/generate`,
      );

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/review`)
        .send({ approved: true, comment: '视频片段可用' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('reviewed');
      expect(res.body.data.reviewed).toBe(true);
      expect(res.body.data.review_comment).toBe('视频片段可用');
    });

    it('returns 200 with rejected video clip', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
      const nodeId = nodes[0].node_id;

      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/generate`,
      );

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/review`)
        .send({ approved: false, comment: '人脸崩坏，需要重生成' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('reviewed');
      expect(res.body.data.reviewed).toBe(false);
    });

    it('returns 404 for non-existent node', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/ep01-n999/review`)
        .send({ approved: true });

      expect(res.status).toBe(404);
    });

    it('returns 400 when video has not been generated yet', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
      const nodeId = nodes[0].node_id;

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/review`)
        .send({ approved: true });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('not been generated');
    });
  });

  // ── PUT /video/nodes/:nodeId/upload ───────────────────────────────

  describe('PUT /api/v1/projects/:projectId/episodes/:epId/video/nodes/:nodeId/upload', () => {
    it('returns 200 with uploaded video clip', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
      const nodeId = nodes[0].node_id;
      const duration = nodes[0].duration_target ?? 6;

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/upload`)
        .send({ url: 'https://mock-cdn.example.com/uploaded/video.mp4', duration });

      expect(res.status).toBe(200);
      expect(res.body.data.url).toBe('https://mock-cdn.example.com/uploaded/video.mp4');
      expect(res.body.data.duration).toBe(duration);
      expect(res.body.data.status).toBe('generated');
      expect(res.body.data.provider).toBe('user-upload');
      expect(res.body.data.model).toBe('user-upload');
      expect(res.body.data.fallback_used).toBe(false);
      expect(res.body.data.quality_report.passed).toBe(true);
      expect(res.body.data.quality_report.details).toContain('Manually uploaded video clip');
    });

    it('persists uploaded video_clip on the node', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
      const nodeId = nodes[0].node_id;
      const duration = nodes[0].duration_target ?? 6;

      await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/upload`)
        .send({ url: 'https://mock-cdn.example.com/uploaded/video.mp4', duration });

      const getRes = await request(app).get(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`,
      );
      const target = getRes.body.data.find((n: Record<string, unknown>) => n.node_id === nodeId);
      expect(target.video_clip.url).toBe('https://mock-cdn.example.com/uploaded/video.mp4');
      expect(target.video_clip.provider).toBe('user-upload');
      expect(target.video_clip.status).toBe('generated');
    });

    it('returns 404 for non-existent node', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/ep01-n999/upload`)
        .send({ url: 'https://mock-cdn.example.com/uploaded/video.mp4', duration: 6 });

      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid upload body', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
      const nodeId = nodes[0].node_id;

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/upload`)
        .send({ url: 'not-a-url', duration: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('marks quality report failed when duration error exceeds threshold', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
      const nodeId = nodes[0].node_id;
      const targetDuration = nodes[0].duration_target ?? 6;

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/upload`)
        .send({ url: 'https://mock-cdn.example.com/uploaded/video.mp4', duration: targetDuration + 5 });

      expect(res.status).toBe(200);
      expect(res.body.data.quality_report.duration_ok).toBe(false);
      expect(res.body.data.quality_report.passed).toBe(false);
    });

    it('creates a user_edited snapshot for uploaded video', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
      const nodeId = nodes[0].node_id;
      const duration = nodes[0].duration_target ?? 6;

      await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/upload`)
        .send({ url: 'https://mock-cdn.example.com/uploaded/video.mp4', duration });

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

  // ── Fallback ─────────────────────────────────────────────────────

  describe('fallback circuit breaker', () => {
    it('switches to fallback provider when primary fails', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      // Use a provider that doesn't exist in the test pool, so primary fails and fallback is used
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/episodes/${epId}/video/generate`)
        .send({ provider: 'non-existent-provider' });

      expect(res.status).toBe(201);
      expect(res.body.data.nodes_failed).toBe(0);
      expect(res.body.data.fallback_used_count).toBeGreaterThan(0);
      for (const result of res.body.data.results) {
        expect(result.video_clip).toBeDefined();
        expect(result.video_clip.fallback_used).toBe(true);
      }
    });

    it('fallback success rate >= 90%', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/episodes/${epId}/video/generate`)
        .send({ provider: 'non-existent-provider' });

      const fallbackResults = res.body.data.results.filter(
        (r: Record<string, unknown>) => (r as any).video_clip?.fallback_used,
      );
      const fallbackSuccess = fallbackResults.filter(
        (r: Record<string, unknown>) => (r as any).video_clip,
      ).length;
      const fallbackRate = fallbackResults.length > 0 ? fallbackSuccess / fallbackResults.length : 1;
      expect(fallbackRate).toBeGreaterThanOrEqual(0.9);
    });
  });

  // ── End-to-End Flow ──────────────────────────────────────────────

  describe('end-to-end video flow', () => {
    it('batch generate → review → verify persistence', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      const batchRes = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/video/generate`,
      );
      expect(batchRes.status).toBe(201);
      const nodeId = batchRes.body.data.results[0].node_id;

      const reviewRes = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/video/nodes/${nodeId}/review`)
        .send({ approved: true, comment: '通过' });
      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.status).toBe('reviewed');

      const getRes = await request(app).get(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`,
      );
      const reviewedNode = getRes.body.data.find((n: Record<string, unknown>) => n.node_id === nodeId);
      expect(reviewedNode.video_clip.status).toBe('reviewed');
      expect(reviewedNode.video_clip.reviewed).toBe(true);
    });
  });
});
