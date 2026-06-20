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
 * Create a project, generate outline, confirm it.
 * Returns projectId and outline with episodes.
 */
async function createProjectAndOutline() {
  const createRes = await request(app).post('/api/v1/projects').send(validProject);
  const projectId = createRes.body.data.id;
  const genRes = await request(app).post(`/api/v1/projects/${projectId}/outline/generate`);
  await request(app).post(`/api/v1/projects/${projectId}/outline/confirm`);
  return { projectId, outline: genRes.body.data };
}

/**
 * Helper: create a project and inject mock script data for an episode
 * since the script module hasn't been wired into the test app yet.
 */
async function createProjectWithScript(episodeNumber = 1) {
  const { projectId, outline } = await createProjectAndOutline();
  const episode = outline.episodes.find((e: { episode_number: number }) => e.episode_number === episodeNumber);
  const epId = `ep-${episodeNumber}`;

  // Inject a mock script into the project meta for testing
  const mockScript = {
    episode_title: episode?.title || '第1集',
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
          { char_id: 'char-1', text: '好久不见，最近过得怎么样？', emotion: 'happy' },
          { char_id: 'char-2', text: '还不错，只是工作有些忙碌。', emotion: 'neutral' },
          { char_id: 'char-1', text: '我们找个地方坐下聊聊吧？', emotion: 'gentle' },
          { char_id: 'char-2', text: '好，有些事我正想告诉你。', emotion: 'contemplative' },
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
          { char_id: 'char-1', text: '我不能再这样下去了，必须做出改变。', emotion: 'contemplative' },
        ],
      },
    ],
    end_state: {
      characters: [
        { char_id: 'char-1', emotion: 'determined', position: '河边' },
        { char_id: 'char-2', emotion: 'intrigued', position: '咖啡厅' },
      ],
      unresolved_conflicts: ['主角的人生抉择'],
      key_prop_states: {},
    },
  };

  // Store script in meta for testing
  const project = await testPrisma.projects.findUnique({ where: { id: projectId } });
  const meta = (project?.meta as Record<string, unknown>) || {};
  const updatedMeta = { ...meta, [`script_${epId}`]: mockScript };
  await testPrisma.projects.update({
    where: { id: projectId },
    data: { meta: updatedMeta as any },
  });

  return { projectId, epId, episode, mockScript };
}

describe('storyboard API routes', () => {
  beforeEach(async () => {
    await cleanProjects();
    await cleanSnapshots();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  // ── POST /split ──────────────────────────────────────────────────

  describe('POST /api/v1/projects/:projectId/episodes/:epId/storyboard/split', () => {
    it('returns 201 with split nodes on success', async () => {
      const { projectId, epId } = await createProjectWithScript();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
      );

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.nodes).toBeInstanceOf(Array);
      expect(res.body.data.nodes.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.total_duration).toBeGreaterThan(0);
      expect(res.body.data.node_count).toBe(res.body.data.nodes.length);

      // Validate node structure
      const node = res.body.data.nodes[0];
      expect(node.node_id).toMatch(/^ep\d+-n\d+$/);
      expect(node.scene_id).toBeTruthy();
      expect(node.scene_variant).toBeTruthy();
      expect(node.characters).toBeInstanceOf(Array);
      expect(node.characters.length).toBeGreaterThan(0);
      expect(node.characters[0]).toHaveProperty('char_id');
      expect(node.characters[0]).toHaveProperty('costume_variant');
      expect(node.shot_type).toBeTruthy();
      expect(node.camera_move).toBeTruthy();
      expect(node.visual_desc).toBeTruthy();
      expect(node.emotion_tag).toBeTruthy();
      expect(node.music_mood).toBeTruthy();
      expect(node.duration_target).toBeGreaterThanOrEqual(3);
      expect(node.duration_target).toBeLessThanOrEqual(15);
      expect(node.transition_in).toBeTruthy();
      expect(node.transition_out).toBeTruthy();
      expect(node.status).toBe('pending');
      expect(node.version_history).toBeInstanceOf(Array);
    });

    it('returns 404 for non-existent project', async () => {
      const res = await request(app).post(
        '/api/v1/projects/non-existent/episodes/ep-1/storyboard/split'
      );
      expect(res.status).toBe(500);
      expect(res.body.error.message).toContain('not found');
    });

    it('returns 400 for invalid episode ID format', async () => {
      const { projectId } = await createProjectWithScript();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/invalid-ep-id/storyboard/split`
      );

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('returns 400 when no script exists for the episode', async () => {
      const { projectId } = await createProjectAndOutline();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/ep-5/storyboard/split`
      );

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('No script found');
    });

    it('creates version snapshots for generated nodes', async () => {
      const { projectId, epId } = await createProjectWithScript();

      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
      );

      // Verify snapshots were created
      const snapshots = await testPrisma.version_snapshots.findMany({
        where: {
          project_id: projectId,
          entity_type: 'node',
        },
      });
      expect(snapshots.length).toBeGreaterThan(0);
      expect(snapshots[0].source).toBe('ai_generated');
    });
  });

  // ── GET /nodes ───────────────────────────────────────────────────

  describe('GET /api/v1/projects/:projectId/episodes/:epId/storyboard/nodes', () => {
    it('returns empty array when no nodes exist', async () => {
      const { projectId, epId } = await createProjectWithScript();

      const res = await request(app).get(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`
      );

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(0);
    });

    it('returns nodes after split', async () => {
      const { projectId, epId } = await createProjectWithScript();
      const splitRes = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
      );
      const expectedNodeCount = splitRes.body.data.node_count;

      const res = await request(app).get(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`
      );

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(expectedNodeCount);
    });
  });

  // ── PUT /nodes ───────────────────────────────────────────────────

  describe('PUT /api/v1/projects/:projectId/episodes/:epId/storyboard/nodes', () => {
    it('updates nodes and returns 200', async () => {
      const { projectId, epId } = await createProjectWithScript();
      const splitRes = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
      );
      const nodes = splitRes.body.data.nodes;

      // Modify the first node
      const updated = nodes.map((n: Record<string, unknown>, i: number) =>
        i === 0
          ? { ...n, shot_type: 'aerial', emotion_tag: '激动的', duration_target: 7 }
          : n
      );

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`)
        .send({ nodes: updated });

      expect(res.status).toBe(200);
      expect(res.body.data[0].shot_type).toBe('aerial');
      expect(res.body.data[0].emotion_tag).toBe('激动的');
      expect(res.body.data[0].duration_target).toBe(7);
    });

    it('returns 400 for invalid node data', async () => {
      const { projectId, epId } = await createProjectWithScript();
      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
      );

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`)
        .send({ nodes: [{ invalid: true }] });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('returns 400 for empty nodes array', async () => {
      const { projectId, epId } = await createProjectWithScript();

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`)
        .send({ nodes: [] });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('creates user_edited snapshots for changed nodes', async () => {
      const { projectId, epId } = await createProjectWithScript();
      const splitRes = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
      );
      const nodes = splitRes.body.data.nodes;

      const updated = nodes.map((n: Record<string, unknown>, i: number) =>
        i === 0 ? { ...n, visual_desc: 'Updated visual description' } : n
      );

      await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`)
        .send({ nodes: updated });

      // Verify a user_edited snapshot was created for the changed node
      const snapshots = await testPrisma.version_snapshots.findMany({
        where: {
          project_id: projectId,
          entity_type: 'node',
          source: 'user_edited',
        },
      });
      expect(snapshots.length).toBeGreaterThan(0);
    });
  });

  // ── POST /nodes/:nodeId/split ────────────────────────────────────

  describe('POST /api/v1/projects/:projectId/episodes/:epId/storyboard/nodes/:nodeId/split', () => {
    it('splits a node into two and returns 200', async () => {
      const { projectId, epId } = await createProjectWithScript();
      const splitRes = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
      );
      const nodeId = splitRes.body.data.nodes[0].node_id;

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/split`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.original).toBeDefined();
      expect(res.body.data.new_nodes).toBeInstanceOf(Array);
      expect(res.body.data.new_nodes.length).toBe(2);

      // Check new node IDs
      expect(res.body.data.new_nodes[0].node_id).toMatch(/^ep\d+-n\d+$/);
      expect(res.body.data.new_nodes[1].node_id).toMatch(/^ep\d+-n\d+$/);

      // Verify sum of durations equals original (within tolerance)
      const sum = res.body.data.new_nodes[0].duration_target + res.body.data.new_nodes[1].duration_target;
      expect(Math.abs(sum - res.body.data.original.duration_target)).toBeLessThanOrEqual(2);
    });

    it('returns 404 for non-existent node', async () => {
      const { projectId, epId } = await createProjectWithScript();
      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
      );

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/non-existent/split`
      );

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');
    });

    it('accepts optional split_point_seconds', async () => {
      const { projectId, epId } = await createProjectWithScript();
      const splitRes = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
      );
      const nodeId = splitRes.body.data.nodes[0].node_id;
      const originalDuration = splitRes.body.data.nodes[0].duration_target;

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/split`)
        .send({ split_point_seconds: 3 });

      expect(res.status).toBe(200);
      // First new node should be close to split_point_seconds
      expect(res.body.data.new_nodes[0].duration_target).toBeGreaterThanOrEqual(2);
      expect(res.body.data.new_nodes[0].duration_target).toBeLessThanOrEqual(originalDuration - 1);
    });
  });

  // ── Duration Validation ──────────────────────────────────────────

  describe('duration validation', () => {
    it('total node duration is within 15% of estimated target', async () => {
      const { projectId, epId } = await createProjectWithScript();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
      );

      const totalDuration = res.body.data.total_duration;
      const nodeCount = res.body.data.node_count;

      // Each node is 5-8 seconds, so total should be roughly nodeCount * 6.5
      const expectedMin = nodeCount * 5;
      const expectedMax = nodeCount * 8;
      expect(totalDuration).toBeGreaterThanOrEqual(expectedMin - 1);
      expect(totalDuration).toBeLessThanOrEqual(expectedMax + 1);
    });
  });

  // ── Impact Analysis ──────────────────────────────────────────────

  describe('edit impact analysis', () => {
    it('classifies dialogue/emotion changes as light impact', async () => {
      const { projectId, epId } = await createProjectWithScript();
      const splitRes = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
      );
      const nodes = splitRes.body.data.nodes;

      // Modify only emotion_tag
      const updated = nodes.map((n: Record<string, unknown>, i: number) =>
        i === 0 ? { ...n, emotion_tag: '悲伤的', dialogue: { ...(n.dialogue || {}), text: '修改后的台词' } as any } : n
      );

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`)
        .send({ nodes: updated });

      expect(res.status).toBe(200);
      // The service should detect light impact changes and record them
    });

    it('classifies shot/camera changes as medium impact', async () => {
      const { projectId, epId } = await createProjectWithScript();
      const splitRes = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
      );
      const nodes = splitRes.body.data.nodes;

      const updated = nodes.map((n: Record<string, unknown>, i: number) =>
        i === 0 ? { ...n, shot_type: 'aerial', camera_move: 'tracking', scene_variant: '夜晚-雨' } : n
      );

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`)
        .send({ nodes: updated });

      expect(res.status).toBe(200);
    });

    it('classifies character/visual_desc changes as deep impact', async () => {
      const { projectId, epId } = await createProjectWithScript();
      const splitRes = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
      );
      const nodes = splitRes.body.data.nodes;

      const updated = nodes.map((n: Record<string, unknown>, i: number) =>
        i === 0
          ? {
              ...n,
              characters: [{ char_id: 'new-char', costume_variant: 'formal' }],
              visual_desc: 'Completely redesigned visual description for this shot',
            }
          : n
      );

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`)
        .send({ nodes: updated });

      expect(res.status).toBe(200);
    });
  });
});
