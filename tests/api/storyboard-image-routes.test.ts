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
 * Helper: create project with outline
 */
async function createProjectAndOutline() {
  const createRes = await request(app).post('/api/v1/projects').send(validProject);
  const projectId = createRes.body.data.id;
  const genRes = await request(app).post(`/api/v1/projects/${projectId}/outline/generate`);
  await request(app).post(`/api/v1/projects/${projectId}/outline/confirm`);
  return { projectId, outline: genRes.body.data };
}

/**
 * Helper: create characters with confirmed views (IP-Adapter ready) via direct Prisma.
 * Character names match the `characters_present` values in the mock script.
 */
async function createConfirmedCharacters(projectId: string) {
  const created: Array<{ id: string; name: string }> = [];

  // Create character 1: 主角 (matches script characters_present)
  const char1 = await testPrisma.characters.create({
    data: {
      project_id: projectId,
      name: '主角',
      role_type: 'protagonist',
      appearance: '年轻男性，短发，休闲装扮',
      costume: '白色衬衫和牛仔裤',
      status: 'confirmed',
      ip_adapter_id: 'ipadapter-char-1',
      ref_images: [
        { view: 'front', url: 'https://mock-cdn.example.com/image/char1-front.png', seed: 100 },
        { view: 'side', url: 'https://mock-cdn.example.com/image/char1-side.png', seed: 101 },
        { view: 'back', url: 'https://mock-cdn.example.com/image/char1-back.png', seed: 102 },
      ],
    },
  });
  created.push({ id: char1.id, name: char1.name });

  // Create character 2: 重要配角 (matches script characters_present)
  const char2 = await testPrisma.characters.create({
    data: {
      project_id: projectId,
      name: '重要配角',
      role_type: 'supporting',
      appearance: '年轻女性，长发，优雅气质',
      costume: '连衣裙',
      status: 'confirmed',
      ip_adapter_id: 'ipadapter-char-2',
      ref_images: [
        { view: 'front', url: 'https://mock-cdn.example.com/image/char2-front.png', seed: 200 },
        { view: 'side', url: 'https://mock-cdn.example.com/image/char2-side.png', seed: 201 },
        { view: 'back', url: 'https://mock-cdn.example.com/image/char2-back.png', seed: 202 },
      ],
    },
  });
  created.push({ id: char2.id, name: char2.name });

  return created;
}

/**
 * Helper: create a location with confirmed base (seed locked) via direct Prisma.
 */
async function createConfirmedLocation(projectId: string, name: string, baseSeed: number = 42) {
  const loc = await testPrisma.locations.create({
    data: {
      project_id: projectId,
      name,
      description: '咖啡厅内景，温馨舒适的环境',
      space_type: 'indoor',
      style: 'modern',
      lighting_type: '自然光',
      status: 'confirmed',
      base_seed: baseSeed,
      base_image_url: `https://mock-cdn.example.com/image/${name}-base.png`,
      key_props: [],
      variants: {},
    },
  });
  return { id: loc.id, name: loc.name, base_seed: loc.base_seed, base_image_url: loc.base_image_url };
}

/**
 * Helper: create a second location with confirmed base via direct Prisma.
 */
async function createSecondLocation(projectId: string, name: string) {
  const loc = await testPrisma.locations.create({
    data: {
      project_id: projectId,
      name,
      description: '河边步道，傍晚时分',
      space_type: 'outdoor',
      style: 'natural',
      lighting_type: '黄昏光',
      status: 'confirmed',
      base_seed: 77,
      base_image_url: `https://mock-cdn.example.com/image/${name}-base.png`,
      key_props: [],
      variants: {},
    },
  });
  return { id: loc.id, name: loc.name, base_seed: loc.base_seed };
}

/**
 * Full setup: project + characters (IP-Adapter) + locations (seed) + script + storyboard nodes
 */
async function setupFullEnvironment() {
  const { projectId, outline } = await createProjectAndOutline();
  const episode = outline.episodes.find((e: { episode_number: number }) => e.episode_number === 1);
  const epId = 'ep-1';

  // Create confirmed characters (names match characters_present)
  await createConfirmedCharacters(projectId);

  // Create confirmed locations (use descriptive names for lookup)
  const loc1 = await createConfirmedLocation(projectId, '咖啡厅');
  const loc2 = await createSecondLocation(projectId, '河边');

  // Inject mock script with char_ids matching character names and location_ids matching loc names
  const mockScript = {
    episode_title: episode?.title || '第1集',
    scenes: [
      {
        scene_id: 's1',
        location_id: loc1.name,
        time_of_day: '下午',
        weather: '晴天',
        characters_present: ['主角', '重要配角'],
        scene_summary: '主角在咖啡厅与重要配角相遇，两人展开对话',
        beats: ['主角进入咖啡厅', '与配角相遇', '展开关键对话', '离开咖啡厅'],
        dialogues: [
          { char_id: '主角', text: '好久不见，最近过得怎么样？', emotion: '开心的' },
          { char_id: '重要配角', text: '还不错，只是工作有些忙碌。', emotion: '平静的' },
        ],
      },
      {
        scene_id: 's2',
        location_id: loc2.name,
        time_of_day: '傍晚',
        weather: '多云',
        characters_present: ['主角'],
        scene_summary: '主角独自在河边散步，思考人生方向',
        beats: ['走到河边', '望着夕阳沉思', '下定决心', '转身离开'],
        dialogues: [
          { char_id: '主角', text: '我不能再这样下去了，必须做出改变。', emotion: '沉思的' },
        ],
      },
    ],
    end_state: {
      characters: [
        { char_id: '主角', emotion: 'determined', position: '河边' },
        { char_id: '重要配角', emotion: 'intrigued', position: '咖啡厅' },
      ],
      unresolved_conflicts: ['主角的人生抉择'],
      key_prop_states: {},
    },
  };

  const project = await testPrisma.projects.findUnique({ where: { id: projectId } });
  const meta = (project?.meta as Record<string, unknown>) || {};
  const updatedMeta = { ...meta, [`script_${epId}`]: mockScript };
  await testPrisma.projects.update({
    where: { id: projectId },
    data: { meta: updatedMeta as any },
  });

  // Split script into storyboard nodes
  const splitRes = await request(app).post(
    `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
  );
  const nodes = splitRes.body.data.nodes;

  return { projectId, epId, nodes, mockScript, loc1, loc2 };
}

describe('storyboard image generation API routes', () => {
  beforeEach(async () => {
    await cleanProjects();
    await cleanSnapshots();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  // ── POST /nodes/generate (batch) ──────────────────────────────────

  describe('POST /api/v1/projects/:projectId/episodes/:epId/storyboard/nodes/generate', () => {
    it('returns 200 with batch generate results and correct summary', async () => {
      const { projectId, epId } = await setupFullEnvironment();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/generate`
      );

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.results).toBeInstanceOf(Array);
      expect(res.body.data.results.length).toBeGreaterThan(0);

      // Summary
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.total).toBe(res.body.data.results.length);
      expect(res.body.data.summary.completed + res.body.data.summary.needs_redo + res.body.data.summary.failed)
        .toBe(res.body.data.summary.total);

      // IP-Adapter enforcement rate should be 100%
      expect(res.body.data.summary.ip_adapter_injection_rate).toBe(100);

      // Scene seed lock rate should be 100%
      expect(res.body.data.summary.scene_seed_lock_rate).toBe(100);

      // Each result has expected fields
      for (const result of res.body.data.results) {
        expect(result.node_id).toMatch(/^ep\d+-n\d+$/);
        expect(result.image_url).toBeTruthy();
        expect(result.image_seed).toBeGreaterThan(0);
        expect(result.image_prompt).toBeTruthy();
        expect(result.image_negative_prompt).toBeTruthy();
        expect(result.status).toMatch(/^(completed|needs_redo)$/);
        expect(result.refinement_iterations).toBeGreaterThanOrEqual(0);
        expect(result.latency_ms).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns 400 for invalid episode ID format', async () => {
      const { projectId } = await setupFullEnvironment();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/invalid-ep/storyboard/nodes/generate`
      );

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('returns 400 when no nodes exist for the episode', async () => {
      const { projectId } = await createProjectAndOutline();
      const epId = 'ep-2';

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/generate`
      );

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('No storyboard nodes');
    });

    it('updates node data with image metadata after generation', async () => {
      const { projectId, epId } = await setupFullEnvironment();

      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/generate`
      );

      // Fetch nodes to verify image fields were saved
      const getRes = await request(app).get(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`
      );

      const firstNode = getRes.body.data[0];
      expect(firstNode.image_url).toBeTruthy();
      expect(firstNode.image_seed).toBeGreaterThan(0);
      expect(firstNode.image_prompt).toBeTruthy();
      expect(firstNode.image_status).toBe('completed');
    });
  });

  // ── POST /nodes/:nodeId/generate (single) ─────────────────────────

  describe('POST /api/v1/projects/:projectId/episodes/:epId/storyboard/nodes/:nodeId/generate', () => {
    it('returns 200 with generated image for a single node', async () => {
      const { projectId, epId, nodes } = await setupFullEnvironment();
      const nodeId = nodes[0].node_id;

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/generate`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.node_id).toBe(nodeId);
      expect(res.body.data.image_url).toBeTruthy();
      expect(res.body.data.image_seed).toBeGreaterThan(0);
      expect(res.body.data.image_prompt).toBeTruthy();
      expect(res.body.data.image_negative_prompt).toBeTruthy();
      expect(res.body.data.status).toMatch(/^(completed|needs_redo)$/);
      expect(res.body.data.refinement_iterations).toBeGreaterThanOrEqual(0);
    });

    it('returns 404 for non-existent node', async () => {
      const { projectId, epId } = await setupFullEnvironment();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/non-existent/generate`
      );

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');
    });

    it('returns 400 for invalid episode ID', async () => {
      const { projectId } = await setupFullEnvironment();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/bad-ep/storyboard/nodes/ep01-n001/generate`
      );

      expect(res.status).toBe(400);
    });

    it('supports force regeneration when image already exists', async () => {
      const { projectId, epId, nodes } = await setupFullEnvironment();
      const nodeId = nodes[0].node_id;

      // First generate
      const firstRes = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/generate`
      );
      expect(firstRes.status).toBe(200);

      // Force regenerate
      const secondRes = await request(app)
        .post(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/generate`)
        .send({ force: true });

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.data.image_url).toBeTruthy();
    });

    it('high-risk nodes (close-up) have refinement iterations tracked', async () => {
      const { projectId, epId, nodes } = await setupFullEnvironment();

      // Find or create a close-up node
      let closeUpNode = nodes.find((n: any) => n.shot_type === 'close-up');
      if (!closeUpNode) {
        // Update first node to be close-up
        const updated = nodes.map((n: any, i: number) =>
          i === 0 ? { ...n, shot_type: 'close-up' } : n
        );
        await request(app)
          .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`)
          .send({ nodes: updated });
        closeUpNode = updated[0];
      }

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${closeUpNode.node_id}/generate`
      );

      expect(res.status).toBe(200);
      // High-risk nodes should have refinement iterations <= 3
      expect(res.body.data.refinement_iterations).toBeLessThanOrEqual(3);
    });
  });

  // ── PUT /nodes/:nodeId/review ─────────────────────────────────────

  describe('PUT /api/v1/projects/:projectId/episodes/:epId/storyboard/nodes/:nodeId/review', () => {
    it('approves a generated node image and returns 200', async () => {
      const { projectId, epId, nodes } = await setupFullEnvironment();
      const nodeId = nodes[0].node_id;

      // First generate the image
      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/generate`
      );

      // Review: approve
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/review`)
        .send({ approved: true, comment: '画面清晰，构图合理' });

      expect(res.status).toBe(200);
      expect(res.body.data.image_review).toBeDefined();
      expect(res.body.data.image_review.approved).toBe(true);
      expect(res.body.data.image_review.comment).toBe('画面清晰，构图合理');
      expect(res.body.data.image_review.reviewed_at).toBeTruthy();
    });

    it('rejects a generated node image with comment', async () => {
      const { projectId, epId, nodes } = await setupFullEnvironment();
      const nodeId = nodes[0].node_id;

      // First generate
      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/generate`
      );

      // Review: reject
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/review`)
        .send({ approved: false, comment: '角色面部比例失调，需重新生成' });

      expect(res.status).toBe(200);
      expect(res.body.data.image_review.approved).toBe(false);
      expect(res.body.data.image_review.comment).toBe('角色面部比例失调，需重新生成');
      // Rejected nodes should have status changed to needs_redo or similar
    });

    it('returns 400 when node image has not been generated yet', async () => {
      const { projectId, epId, nodes } = await setupFullEnvironment();
      const nodeId = nodes[0].node_id;

      // Skip generation, try to review directly
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/review`)
        .send({ approved: true });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('not been generated');
    });

    it('returns 404 for non-existent node', async () => {
      const { projectId, epId } = await setupFullEnvironment();

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/non-existent/review`)
        .send({ approved: true });

      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid review input', async () => {
      const { projectId, epId, nodes } = await setupFullEnvironment();
      const nodeId = nodes[0].node_id;

      // Generate first
      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/generate`
      );

      // Missing 'approved' field
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/review`)
        .send({ comment: 'no approved field' });

      expect(res.status).toBe(400);
    });

    it('re-reviewing updates the existing review', async () => {
      const { projectId, epId, nodes } = await setupFullEnvironment();
      const nodeId = nodes[0].node_id;

      // Generate
      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/generate`
      );

      // First review: reject
      await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/review`)
        .send({ approved: false, comment: '初版不合格' });

      // Re-generate (force)
      await request(app)
        .post(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/generate`)
        .send({ force: true });

      // Second review: approve
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/${nodeId}/review`)
        .send({ approved: true, comment: '修正后通过' });

      expect(res.status).toBe(200);
      expect(res.body.data.image_review.approved).toBe(true);
      expect(res.body.data.image_review.comment).toBe('修正后通过');
    });
  });

  // ── Enforcement Verification ──────────────────────────────────────

  describe('IP-Adapter and Seed enforcement', () => {
    it('enforces 100% IP-Adapter injection rate when characters are confirmed', async () => {
      const { projectId, epId } = await setupFullEnvironment();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/generate`
      );

      expect(res.body.data.summary.ip_adapter_injection_rate).toBe(100);
    });

    it('enforces 100% scene seed lock rate when locations are confirmed', async () => {
      const { projectId, epId } = await setupFullEnvironment();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/generate`
      );

      expect(res.body.data.summary.scene_seed_lock_rate).toBe(100);
    });

    it('reports missing IP-Adapter when characters are not confirmed', async () => {
      const { projectId } = await createProjectAndOutline();
      const epId = 'ep-1';

      // Create a character WITHOUT ip_adapter_id (not confirmed)
      await testPrisma.characters.create({
        data: {
          project_id: projectId,
          name: '未确认角色',
          role_type: 'protagonist',
          appearance: '神秘角色',
          status: 'draft',
          ip_adapter_id: null,
          ref_images: [],
        },
      });

      // Create location with confirmed base
      const loc = await createConfirmedLocation(projectId, '测试场景');

      // Inject script with the unconfirmed character
      const mockScript = {
        episode_title: '测试集',
        scenes: [
          {
            scene_id: 's1',
            location_id: loc.name,
            time_of_day: '下午',
            weather: '晴天',
            characters_present: ['未确认角色'],
            scene_summary: '测试场景',
            beats: ['测试节拍'],
            dialogues: [{ char_id: '未确认角色', text: '测试台词', emotion: '平静的' }],
          },
        ],
        end_state: { characters: [], unresolved_conflicts: [], key_prop_states: {} },
      };

      const project = await testPrisma.projects.findUnique({ where: { id: projectId } });
      const meta = (project?.meta as Record<string, unknown>) || {};
      await testPrisma.projects.update({
        where: { id: projectId },
        data: { meta: { ...meta, [`script_${epId}`]: mockScript } as any },
      });

      // Split
      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
      );

      // Try to generate — should still work with mock but report lower injection rate
      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes/generate`
      );

      // The enforcement summary should reflect that not all characters have IP-Adapter
      expect(res.body.data.summary.ip_adapter_injection_rate).toBeLessThanOrEqual(100);
    });
  });
});
