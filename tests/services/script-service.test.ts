import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { cleanProjects, cleanSnapshots, disconnectTestDb, testPrisma } from '../helpers/prisma.js';
import { AdapterPool } from '../../src/server/adapters/pool.js';
import { MockTextAdapter } from '../../src/server/adapters/providers/mock/mock-text-adapter.js';
import { createOutlineService } from '../../src/server/services/outline/outline-service.js';
import { createScriptService } from '../../src/server/services/script/script-service.js';
import { createSnapshotService } from '../../src/server/services/snapshot/snapshot-service.js';
import type { ScriptService } from '../../src/server/services/script/types.js';
import type { SnapshotService } from '../../src/server/services/snapshot/types.js';
import type { OutlineService } from '../../src/server/services/outline/types.js';

function createTestServices() {
  const adapterPool = new AdapterPool();
  adapterPool.registerText(new MockTextAdapter());
  const snapshotService = createSnapshotService({ prisma: testPrisma });
  const outlineService = createOutlineService({
    prisma: testPrisma,
    snapshotService,
    adapterPool,
  });
  const scriptService = createScriptService({
    prisma: testPrisma,
    snapshotService,
    adapterPool,
  });
  return { outlineService, scriptService, snapshotService };
}

async function createTestProject() {
  return testPrisma.project.create({
    data: {
      user_id: 'system',
      status: 'draft',
      meta: {
        title: '都市奇缘',
        description: '一段发生在现代都市的浪漫爱情故事',
        genre: 'urban_romance',
        target_episodes: 6,
        duration_goal: '5min',
        style_tags: ['realistic', 'fresh'],
      } as never,
    },
  });
}

describe('ScriptService', () => {
  let outlineService: OutlineService;
  let scriptService: ScriptService;
  let snapshotService: SnapshotService;

  beforeEach(async () => {
    await cleanProjects();
    await cleanSnapshots();
    const services = createTestServices();
    outlineService = services.outlineService;
    scriptService = services.scriptService;
    snapshotService = services.snapshotService;
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  // ── generateScript ───────────────────────────────────────────────

  it('generates a script and stores it in project.meta', async () => {
    const project = await createTestProject();
    await outlineService.generateOutline(project.id);

    const script = await scriptService.generateScript(project.id, 1);
    expect(script.episode_title).toBeTruthy();
    expect(script.scenes.length).toBeGreaterThanOrEqual(1);
    expect(script.end_state.characters.length).toBeGreaterThanOrEqual(1);

    const updated = await testPrisma.project.findUnique({ where: { id: project.id } });
    const meta = updated?.meta as Record<string, unknown> | undefined;
    expect(meta?.['script_ep-1']).toBeDefined();
  });

  it('creates an ai_generated snapshot after generation', async () => {
    const project = await createTestProject();
    await outlineService.generateOutline(project.id);
    await scriptService.generateScript(project.id, 1);

    const history = await snapshotService.getHistory({
      projectId: project.id,
      entityType: 'script',
      entityId: 'ep-1',
    });
    expect(history.total).toBe(1);
    expect(history.versions[0].source).toBe('ai_generated');
  });

  it('throws when project not found', async () => {
    await expect(scriptService.generateScript('non-existent-id', 1)).rejects.toThrow('Project not found');
  });

  it('throws when outline does not exist', async () => {
    const project = await createTestProject();
    await expect(scriptService.generateScript(project.id, 1)).rejects.toThrow('No outline found');
  });

  it('throws when episode number not in outline', async () => {
    const project = await createTestProject();
    await outlineService.generateOutline(project.id);
    await expect(scriptService.generateScript(project.id, 999)).rejects.toThrow('Episode 999 not found');
  });

  // ── getScript ────────────────────────────────────────────────────

  it('returns null when no script exists', async () => {
    const project = await createTestProject();
    await outlineService.generateOutline(project.id);
    const script = await scriptService.getScript(project.id, 1);
    expect(script).toBeNull();
  });

  it('returns the generated script', async () => {
    const project = await createTestProject();
    await outlineService.generateOutline(project.id);
    const generated = await scriptService.generateScript(project.id, 1);

    const fetched = await scriptService.getScript(project.id, 1);
    expect(fetched).toEqual(generated);
  });

  // ── updateScript ─────────────────────────────────────────────────

  it('updates script and creates user_edited snapshot', async () => {
    const project = await createTestProject();
    await outlineService.generateOutline(project.id);
    const original = await scriptService.generateScript(project.id, 1);

    const updated = await scriptService.updateScript(project.id, 1, {
      episode_title: 'Updated Title',
    });
    expect(updated.episode_title).toBe('Updated Title');
    expect(updated.scenes).toEqual(original.scenes);
    expect(updated.end_state).toEqual(original.end_state);

    const history = await snapshotService.getHistory({
      projectId: project.id,
      entityType: 'script',
      entityId: 'ep-1',
    });
    expect(history.total).toBe(2);
    expect(history.versions[0].source).toBe('user_edited');
  });

  it('throws when updating non-existent script', async () => {
    const project = await createTestProject();
    await outlineService.generateOutline(project.id);
    await expect(
      scriptService.updateScript(project.id, 1, { episode_title: 'X' })
    ).rejects.toThrow('Script not found for episode 1');
  });

  // ── regenerateScene ──────────────────────────────────────────────

  it('regenerates a single scene', async () => {
    const project = await createTestProject();
    await outlineService.generateOutline(project.id);
    const original = await scriptService.generateScript(project.id, 1);
    const originalScene = original.scenes[0];

    const newScene = await scriptService.regenerateScene(project.id, 1, originalScene.scene_id);
    expect(newScene.scene_id).toBe(originalScene.scene_id);

    const updated = await scriptService.getScript(project.id, 1);
    expect(updated?.scenes[0]).toEqual(newScene);
    expect(updated?.scenes.length).toBe(original.scenes.length);
  });

  it('creates ai_regenerated snapshot after scene regeneration', async () => {
    const project = await createTestProject();
    await outlineService.generateOutline(project.id);
    const original = await scriptService.generateScript(project.id, 1);
    await scriptService.regenerateScene(project.id, 1, original.scenes[0].scene_id);

    const history = await snapshotService.getHistory({
      projectId: project.id,
      entityType: 'script',
      entityId: 'ep-1',
    });
    expect(history.total).toBe(2);
    expect(history.versions[0].source).toBe('ai_regenerated');
  });

  it('throws when regenerating scene in non-existent script', async () => {
    const project = await createTestProject();
    await outlineService.generateOutline(project.id);
    await expect(
      scriptService.regenerateScene(project.id, 1, 's1')
    ).rejects.toThrow('Script not found for episode 1');
  });

  it('throws when scene id not found', async () => {
    const project = await createTestProject();
    await outlineService.generateOutline(project.id);
    await scriptService.generateScript(project.id, 1);
    await expect(
      scriptService.regenerateScene(project.id, 1, 'missing-scene')
    ).rejects.toThrow('Scene missing-scene not found');
  });

  // ── versions ─────────────────────────────────────────────────────

  it('lists script versions', async () => {
    const project = await createTestProject();
    await outlineService.generateOutline(project.id);
    await scriptService.generateScript(project.id, 1);

    const history = await scriptService.listVersions(project.id, 1);
    expect(history.total).toBe(1);
  });

  it('rolls back to a previous version', async () => {
    const project = await createTestProject();
    await outlineService.generateOutline(project.id);
    const original = await scriptService.generateScript(project.id, 1);
    await scriptService.updateScript(project.id, 1, { episode_title: 'Changed' });

    const history = await scriptService.listVersions(project.id, 1);
    const firstVersion = history.versions[history.versions.length - 1];

    await scriptService.rollbackVersion(project.id, 1, firstVersion.versionId);

    const current = await scriptService.getScript(project.id, 1);
    expect(current?.episode_title).toBe(original.episode_title);
  });
});
