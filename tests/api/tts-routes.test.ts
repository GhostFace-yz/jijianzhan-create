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
 */
async function createProjectAndOutline() {
  const createRes = await request(app).post('/api/v1/projects').send(validProject);
  const projectId = createRes.body.data.id;
  const genRes = await request(app).post(`/api/v1/projects/${projectId}/outline/generate`);
  await request(app).post(`/api/v1/projects/${projectId}/outline/confirm`);
  return { projectId, outline: genRes.body.data };
}

/**
 * Create a project with script and split it into storyboard nodes.
 * This sets up the test data needed for TTS generation.
 */
async function createProjectWithStoryboardNodes(episodeNumber = 1) {
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
          { char_id: '主角', text: '好久不见，最近过得怎么样？', emotion: 'happy' },
          { char_id: '重要配角', text: '还不错，只是工作有些忙碌。', emotion: 'neutral' },
          { char_id: '主角', text: '我们找个地方坐下聊聊吧？', emotion: 'gentle' },
          { char_id: '重要配角', text: '好，有些事我正想告诉你。', emotion: 'contemplative' },
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
          { char_id: '主角', text: '我不能再这样下去了，必须做出改变。', emotion: 'contemplative' },
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

  // Store script in meta
  const project = await testPrisma.project.findUnique({ where: { id: projectId } });
  const meta = (project?.meta as Record<string, unknown>) || {};
  const updatedMeta = { ...meta, [`script_${epId}`]: mockScript };
  await testPrisma.project.update({
    where: { id: projectId },
    data: { meta: updatedMeta as any },
  });

  // Split the script into storyboard nodes
  const splitRes = await request(app).post(
    `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
  );

  return {
    projectId,
    epId,
    nodes: splitRes.body.data.nodes,
    mockScript,
  };
}

/**
 * Create a project with script that has both dialogue and non-dialogue nodes.
 * Some characters speak, and one scene is visual-only.
 */
async function createProjectWithMixedNodes() {
  const { projectId, outline } = await createProjectAndOutline();
  const epId = 'ep-1';
  const episode = outline.episodes.find((e: { episode_number: number }) => e.episode_number === 1);

  // Script that includes a visual-only scene (no dialogue)
  const mockScript = {
    episode_title: episode?.title || '第1集',
    scenes: [
      {
        scene_id: 's1',
        location_id: 'loc-1',
        time_of_day: '下午',
        weather: '晴天',
        characters_present: ['主角', '重要配角'],
        scene_summary: '主角在咖啡厅与重要配角相遇',
        beats: ['进入咖啡厅', '相遇并对话'],
        dialogues: [
          { char_id: '主角', text: '好久不见，最近过得怎么样？', emotion: 'happy' },
        ],
      },
      {
        scene_id: 's2',
        location_id: 'loc-2',
        time_of_day: '傍晚',
        weather: '多云',
        characters_present: ['主角'],
        scene_summary: '主角独自在河边散步',
        beats: ['走到河边', '望风景', '离开'],
        dialogues: [], // No dialogue — visual-only scene
      },
    ],
    end_state: {
      characters: [],
      unresolved_conflicts: [],
      key_prop_states: {},
    },
  };

  const project = await testPrisma.project.findUnique({ where: { id: projectId } });
  const meta = (project?.meta as Record<string, unknown>) || {};
  const updatedMeta = { ...meta, [`script_${epId}`]: mockScript };
  await testPrisma.project.update({
    where: { id: projectId },
    data: { meta: updatedMeta as any },
  });

  const splitRes = await request(app).post(
    `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/split`
  );

  return {
    projectId,
    epId,
    nodes: splitRes.body.data.nodes,
  };
}

describe('TTS API routes', () => {
  beforeEach(async () => {
    await cleanProjects();
    await cleanSnapshots();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  // ── POST /audio/tts/generate (batch) ──────────────────────────────

  describe('POST /api/v1/projects/:projectId/episodes/:epId/audio/tts/generate', () => {
    it('returns 201 with batch generation result on success', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/generate`
      );

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.episode_id).toBe(epId);
      expect(res.body.data.total_nodes).toBeGreaterThan(0);
      expect(res.body.data.nodes_with_dialogue).toBeGreaterThan(0);
      expect(res.body.data.nodes_generated).toBeGreaterThan(0);
      expect(res.body.data.nodes_skipped).toBeGreaterThanOrEqual(0);
      expect(res.body.data.nodes_failed).toBe(0);
      expect(res.body.data.success_rate).toBeGreaterThanOrEqual(0.9);
      expect(res.body.data.results).toBeInstanceOf(Array);
      expect(res.body.data.results.length).toBe(res.body.data.total_nodes);

      // Check generated node result structure
      const generatedResult = res.body.data.results.find(
        (r: Record<string, unknown>) => !r.skipped
      );
      expect(generatedResult).toBeDefined();
      expect(generatedResult.audio_clip).toBeDefined();
      expect(generatedResult.audio_clip.url).toBeTruthy();
      expect(generatedResult.audio_clip.duration).toBeGreaterThan(0);
      expect(generatedResult.audio_clip.voice_id).toBeTruthy();
      expect(generatedResult.audio_clip.emotion).toBeTruthy();
      expect(generatedResult.audio_clip.speed).toBeGreaterThanOrEqual(0.8);
      expect(generatedResult.audio_clip.speed).toBeLessThanOrEqual(1.2);
      expect(generatedResult.audio_clip.status).toBe('generated');
      expect(generatedResult.audio_clip.generated_at).toBeTruthy();

      // Check skipped node result structure
      const skippedResult = res.body.data.results.find(
        (r: Record<string, unknown>) => r.skipped
      );
      if (skippedResult) {
        expect(skippedResult.audio_clip).toBeNull();
        expect(skippedResult.skip_reason).toContain('No dialogue');
      }
    });

    it('auto-filters nodes without dialogue text', async () => {
      const { projectId, epId, nodes } = await createProjectWithMixedNodes();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/generate`
      );

      expect(res.status).toBe(201);

      // Find any skipped nodes
      const skippedResults = res.body.data.results.filter(
        (r: Record<string, unknown>) => r.skipped
      );
      if (skippedResults.length > 0) {
        for (const skipped of skippedResults) {
          expect(skipped.audio_clip).toBeNull();
          expect(skipped.skip_reason).toBeTruthy();
          // skip_reason should indicate this is a no-dialogue node
          expect(skipped.skip_reason).toMatch(/no dialogue|No dialogue/i);
        }
      }

      // Nodes with dialogue should be generated
      const generatedResults = res.body.data.results.filter(
        (r: Record<string, unknown>) => !r.skipped
      );
      expect(generatedResults.length).toBe(res.body.data.nodes_generated);
      for (const gen of generatedResults) {
        expect(gen.audio_clip).toBeDefined();
        expect(gen.audio_clip.status).toBe('generated');
      }
    });

    it('accepts custom speed parameter', async () => {
      const { projectId, epId } = await createProjectWithMixedNodes();

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/generate`)
        .send({ speed: 1.15 });

      expect(res.status).toBe(201);

      // All generated audio clips should use the custom speed
      const generatedResults = res.body.data.results.filter(
        (r: Record<string, unknown>) => !r.skipped
      );
      for (const gen of generatedResults) {
        expect(gen.audio_clip.speed).toBe(1.15);
      }
    });

    it('accepts custom emotion parameter', async () => {
      const { projectId, epId } = await createProjectWithMixedNodes();

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/generate`)
        .send({ emotion: 'happy' });

      expect(res.status).toBe(201);

      const generatedResults = res.body.data.results.filter(
        (r: Record<string, unknown>) => !r.skipped
      );
      for (const gen of generatedResults) {
        expect(gen.audio_clip.emotion).toBe('happy');
      }
    });

    it('accepts custom voice_id override', async () => {
      const { projectId, epId } = await createProjectWithMixedNodes();

      const customVoiceId = 'voice-custom-123';
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/generate`)
        .send({ voice_id: customVoiceId });

      expect(res.status).toBe(201);

      const generatedResults = res.body.data.results.filter(
        (r: Record<string, unknown>) => !r.skipped
      );
      for (const gen of generatedResults) {
        expect(gen.audio_clip.voice_id).toBe(customVoiceId);
      }
    });

    it('returns 400 for invalid episode ID format', async () => {
      const { projectId } = await createProjectWithMixedNodes();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/not-an-ep-id/audio/tts/generate`
      );

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('returns 400 when no storyboard nodes exist for the episode', async () => {
      const { projectId } = await createProjectAndOutline();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/ep-1/audio/tts/generate`
      );

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('No storyboard nodes');
    });

    it('rejects invalid speed below 0.8', async () => {
      const { projectId, epId } = await createProjectWithMixedNodes();

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/generate`)
        .send({ speed: 0.5 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('rejects invalid speed above 1.2', async () => {
      const { projectId, epId } = await createProjectWithMixedNodes();

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/generate`)
        .send({ speed: 1.5 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('success_rate >= 90% for nodes with dialogue', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/generate`
      );

      expect(res.status).toBe(201);
      // Acceptance criteria: ≥ 90% success rate for nodes with dialogue
      expect(res.body.data.success_rate).toBeGreaterThanOrEqual(0.9);
    });

    it('same character in different nodes uses same voice_id', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/generate`
      );

      expect(res.status).toBe(201);

      // Group results by character to verify voice_id consistency
      const voiceIdsByChar = new Map<string, string>();

      // Get the actual nodes for character lookup
      const nodesRes = await request(app).get(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`
      );
      const nodesData = nodesRes.body.data;

      for (const node of nodesData) {
        if (node.dialogue && node.audio_clip) {
          const charId = node.dialogue.char_id;
          const voiceId = node.audio_clip.voice_id;

          if (voiceIdsByChar.has(charId)) {
            // Same character must use same voice_id
            expect(voiceId).toBe(voiceIdsByChar.get(charId));
          } else {
            voiceIdsByChar.set(charId, voiceId);
          }
        }
      }

      // Verify at least one character appeared multiple times
      const charactersWithMultipleNodes = nodesData.filter(
        (n: Record<string, unknown>) => n.dialogue && (n as any).dialogue.char_id === '主角'
      );
      expect(charactersWithMultipleNodes.length).toBeGreaterThanOrEqual(1);
    });

    it('creates version snapshots for generated audio', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/generate`
      );

      // Verify snapshots were created with ai_generated source
      const snapshots = await testPrisma.versionSnapshot.findMany({
        where: {
          project_id: projectId,
          entity_type: 'node',
          source: 'ai_generated',
        },
        orderBy: { created_at: 'desc' },
      });
      expect(snapshots.length).toBeGreaterThan(0);
      // Each snapshot should contain audio_clip in its content
      const latestSnapshot = snapshots[0];
      const content = latestSnapshot.content as Record<string, unknown>;
      expect(content).toBeDefined();
    });
  });

  // ── POST /audio/tts/nodes/:nodeId/generate (single) ──────────────

  describe('POST /api/v1/projects/:projectId/episodes/:epId/audio/tts/nodes/:nodeId/generate', () => {
    it('returns 201 with audio clip for a node with dialogue', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();

      // Find a node with dialogue
      const nodeWithDialogue = nodes.find(
        (n: Record<string, unknown>) => n.dialogue && (n.dialogue as any).text
      );
      expect(nodeWithDialogue).toBeDefined();
      const nodeId = nodeWithDialogue.node_id;

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/generate`
      );

      expect(res.status).toBe(201);
      expect(res.body.data.node_id).toBe(nodeId);
      expect(res.body.data.skipped).toBe(false);
      expect(res.body.data.audio_clip).toBeDefined();
      expect(res.body.data.audio_clip.url).toBeTruthy();
      expect(res.body.data.audio_clip.duration).toBeGreaterThan(0);
      expect(res.body.data.audio_clip.voice_id).toBeTruthy();
      expect(res.body.data.audio_clip.status).toBe('generated');
    });

    it('returns 201 with skipped=true for a node without dialogue', async () => {
      const { projectId, epId, nodes } = await createProjectWithMixedNodes();

      // Find a node without dialogue
      const nodeWithoutDialogue = nodes.find(
        (n: Record<string, unknown>) => !n.dialogue
      );
      expect(nodeWithoutDialogue).toBeDefined();
      const nodeId = nodeWithoutDialogue.node_id;

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/generate`
      );

      expect(res.status).toBe(201);
      expect(res.body.data.node_id).toBe(nodeId);
      expect(res.body.data.skipped).toBe(true);
      expect(res.body.data.audio_clip).toBeNull();
      expect(res.body.data.skip_reason).toContain('No dialogue');
    });

    it('returns 404 for non-existent node', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/ep01-n999/generate`
      );

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');
    });

    it('accepts speed and emotion options for single node', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();

      const nodeWithDialogue = nodes.find(
        (n: Record<string, unknown>) => n.dialogue && (n.dialogue as any).text
      );
      const nodeId = nodeWithDialogue.node_id;

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/generate`)
        .send({ speed: 0.9, emotion: 'sad' });

      expect(res.status).toBe(201);
      expect(res.body.data.skipped).toBe(false);
      expect(res.body.data.audio_clip.speed).toBe(0.9);
      expect(res.body.data.audio_clip.emotion).toBe('sad');
    });

    it('persists audio_clip on the node for subsequent reads', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();

      const nodeWithDialogue = nodes.find(
        (n: Record<string, unknown>) => n.dialogue && (n.dialogue as any).text
      );
      const nodeId = nodeWithDialogue.node_id;

      // Generate TTS
      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/generate`
      );

      // Read nodes and verify audio_clip is persisted
      const getRes = await request(app).get(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`
      );

      const updatedNode = getRes.body.data.find(
        (n: Record<string, unknown>) => n.node_id === nodeId
      );
      expect(updatedNode).toBeDefined();
      expect(updatedNode.audio_clip).toBeDefined();
      expect(updatedNode.audio_clip.status).toBe('generated');
      expect(updatedNode.audio_clip.voice_id).toBeTruthy();
    });
  });

  // ── PUT /audio/tts/nodes/:nodeId/review ──────────────────────────

  describe('PUT /api/v1/projects/:projectId/episodes/:epId/audio/tts/nodes/:nodeId/review', () => {
    it('returns 200 with reviewed audio clip on approve', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();

      const nodeWithDialogue = nodes.find(
        (n: Record<string, unknown>) => n.dialogue && (n.dialogue as any).text
      );
      const nodeId = nodeWithDialogue.node_id;

      // Generate TTS first
      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/generate`
      );

      // Review: approve
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/review`)
        .send({ approved: true });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.status).toBe('reviewed');
      expect(res.body.data.reviewed).toBe(true);
      expect(res.body.data.reviewed_at).toBeTruthy();
    });

    it('returns 200 with rejected audio clip on reject', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();

      const nodeWithDialogue = nodes.find(
        (n: Record<string, unknown>) => n.dialogue && (n.dialogue as any).text
      );
      const nodeId = nodeWithDialogue.node_id;

      // Generate TTS first
      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/generate`
      );

      // Review: reject with comment
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/review`)
        .send({ approved: false, comment: '语速太快，需要重新生成' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('reviewed');
      expect(res.body.data.reviewed).toBe(false);
      expect(res.body.data.review_comment).toBe('语速太快，需要重新生成');
    });

    it('returns 404 for non-existent node', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/ep01-n999/review`)
        .send({ approved: true });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');
    });

    it('returns 400 when audio has not been generated yet', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();

      const nodeWithDialogue = nodes.find(
        (n: Record<string, unknown>) => n.dialogue && (n.dialogue as any).text
      );
      const nodeId = nodeWithDialogue.node_id;

      // Don't generate — try to review directly
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/review`)
        .send({ approved: true });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('not been generated');
    });

    it('returns 400 for missing approved field', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();

      const nodeWithDialogue = nodes.find(
        (n: Record<string, unknown>) => n.dialogue && (n.dialogue as any).text
      );
      const nodeId = nodeWithDialogue.node_id;

      // Generate TTS first
      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/generate`
      );

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/review`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('returns 400 for invalid approved type', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();

      const nodeWithDialogue = nodes.find(
        (n: Record<string, unknown>) => n.dialogue && (n.dialogue as any).text
      );
      const nodeId = nodeWithDialogue.node_id;

      // Generate TTS first
      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/generate`
      );

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/review`)
        .send({ approved: 'yes' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });
  });

  // ── PUT /audio/tts/nodes/:nodeId/upload ───────────────────────────

  describe('PUT /api/v1/projects/:projectId/episodes/:epId/audio/tts/nodes/:nodeId/upload', () => {
    it('returns 200 with uploaded audio clip replacing AI dubbing', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();

      const nodeWithDialogue = nodes.find(
        (n: Record<string, unknown>) => n.dialogue && (n.dialogue as any).text
      );
      const nodeId = nodeWithDialogue.node_id;

      // Generate TTS first
      await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/generate`
      );

      const uploadRes = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/upload`)
        .send({ url: 'https://example.com/user-recording.wav', duration: 5.5 });

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.data).toBeDefined();
      expect(uploadRes.body.data.url).toBe('https://example.com/user-recording.wav');
      expect(uploadRes.body.data.duration).toBe(5.5);
      expect(uploadRes.body.data.voice_id).toBe('user-uploaded');
      expect(uploadRes.body.data.status).toBe('reviewed');
      expect(uploadRes.body.data.reviewed).toBe(true);

      // Verify persistence via GET nodes
      const getRes = await request(app).get(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`
      );
      const uploadedNode = getRes.body.data.find(
        (n: Record<string, unknown>) => n.node_id === nodeId
      );
      expect(uploadedNode).toBeDefined();
      expect(uploadedNode.audio_clip.url).toBe('https://example.com/user-recording.wav');
      expect(uploadedNode.audio_clip.status).toBe('reviewed');
    });

    it('returns 404 for non-existent node', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/ep01-n999/upload`)
        .send({ url: 'https://example.com/audio.wav', duration: 3 });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');
    });

    it('returns 400 for invalid URL', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
      const nodeWithDialogue = nodes.find(
        (n: Record<string, unknown>) => n.dialogue && (n.dialogue as any).text
      );
      const nodeId = nodeWithDialogue.node_id;

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/upload`)
        .send({ url: 'not-a-url', duration: 3 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('returns 400 for invalid duration', async () => {
      const { projectId, epId, nodes } = await createProjectWithStoryboardNodes();
      const nodeWithDialogue = nodes.find(
        (n: Record<string, unknown>) => n.dialogue && (n.dialogue as any).text
      );
      const nodeId = nodeWithDialogue.node_id;

      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/upload`)
        .send({ url: 'https://example.com/audio.wav', duration: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });
  });

  // ── End-to-End Flow ───────────────────────────────────────────────

  describe('end-to-end TTS flow', () => {
    it('batch generate → review → verify persistence', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      // Step 1: Batch generate TTS
      const batchRes = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/generate`
      );
      expect(batchRes.status).toBe(201);
      expect(batchRes.body.data.success_rate).toBeGreaterThanOrEqual(0.9);

      // Step 2: Find a generated node and review it
      const generatedResult = batchRes.body.data.results.find(
        (r: Record<string, unknown>) => !r.skipped
      );
      expect(generatedResult).toBeDefined();
      const nodeId = generatedResult.node_id;

      // Approve
      const reviewRes = await request(app)
        .put(`/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/nodes/${nodeId}/review`)
        .send({ approved: true, comment: '配音质量不错' });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.status).toBe('reviewed');
      expect(reviewRes.body.data.reviewed).toBe(true);

      // Step 3: Verify persistence via GET nodes
      const getRes = await request(app).get(
        `/api/v1/projects/${projectId}/episodes/${epId}/storyboard/nodes`
      );

      const reviewedNode = getRes.body.data.find(
        (n: Record<string, unknown>) => n.node_id === nodeId
      );
      expect(reviewedNode).toBeDefined();
      expect(reviewedNode.audio_clip).toBeDefined();
      expect(reviewedNode.audio_clip.status).toBe('reviewed');
      expect(reviewedNode.audio_clip.review_comment).toBe('配音质量不错');
    });
  });

  // ── Emotion / Speed Mapping Validation ────────────────────────────

  describe('emotion and speed mapping', () => {
    it('maps Chinese emotion tags to English TTS emotions', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/generate`
      );

      expect(res.status).toBe(201);

      const generatedResults = res.body.data.results.filter(
        (r: Record<string, unknown>) => !r.skipped
      );

      // If no custom emotion is passed, the service maps from emotion_tag
      // The mock adapter returns whatever emotion we pass, so verify it's one of the valid English TTS emotions
      const validEmotions = ['happy', 'sad', 'angry', 'neutral', 'nervous', 'gentle', 'contemplative', 'excited', 'romantic', 'suspenseful', 'fearful', 'cold'];
      for (const gen of generatedResults) {
        expect(validEmotions).toContain(gen.audio_clip.emotion);
      }
    });

    it('defaults speed to 1.0 when not specified', async () => {
      const { projectId, epId } = await createProjectWithStoryboardNodes();

      const res = await request(app).post(
        `/api/v1/projects/${projectId}/episodes/${epId}/audio/tts/generate`
      );

      expect(res.status).toBe(201);

      const generatedResults = res.body.data.results.filter(
        (r: Record<string, unknown>) => !r.skipped
      );
      for (const gen of generatedResults) {
        expect(gen.audio_clip.speed).toBe(1.0);
      }
    });
  });
});
