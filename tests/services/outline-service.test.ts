import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { cleanProjects, cleanSnapshots, disconnectTestDb, testPrisma } from '../helpers/prisma.js';
import { AdapterPool } from '../../src/server/adapters/pool.js';
import { MockTextAdapter } from '../../src/server/adapters/providers/mock/mock-text-adapter.js';
import { createOutlineService } from '../../src/server/services/outline/outline-service.js';
import { createSnapshotService } from '../../src/server/services/snapshot/snapshot-service.js';
import type { OutlineService } from '../../src/server/services/outline/types.js';
import type { SnapshotService } from '../../src/server/services/snapshot/types.js';

function createTestServices() {
  const adapterPool = new AdapterPool();
  adapterPool.registerText(new MockTextAdapter());
  const snapshotService = createSnapshotService({ prisma: testPrisma });
  const service = createOutlineService({
    prisma: testPrisma,
    snapshotService,
    adapterPool,
  });
  return { service, snapshotService };
}

async function createTestProject(overrides: Record<string, unknown> = {}) {
  return testPrisma.projects.create({
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
        ...overrides,
      } as never,
    },
  });
}

describe('OutlineService', () => {
  let service: OutlineService;
  let snapshotService: SnapshotService;

  beforeEach(async () => {
    await cleanProjects();
    await cleanSnapshots();
    const svc = createTestServices();
    service = svc.service;
    snapshotService = svc.snapshotService;
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  // ── generateOutline ────────────────────────────────────────────

  it('generates an outline via AI and stores it on the project', async () => {
    const project = await createTestProject();
    const outline = await service.generateOutline(project.id);

    expect(outline).toBeDefined();
    expect(outline.world_setting).toBeTruthy();
    expect(outline.main_conflict).toBeTruthy();
    expect(outline.characters.length).toBeGreaterThanOrEqual(1);
    expect(outline.locations.length).toBeGreaterThanOrEqual(1);
    expect(outline.episodes.length).toBe(outline.episode_count);
    expect(outline.episodes.length).toBeGreaterThanOrEqual(1);

    // Verify stored in DB
    const updated = await testPrisma.projects.findUnique({ where: { id: project.id } });
    expect(updated?.status).toBe('outlining');
    const stored = updated?.outline as Record<string, unknown> | null;
    expect(stored).toBeDefined();
    expect(stored?.world_setting).toBeTruthy();
  });

  it('creates an ai_generated snapshot after generation', async () => {
    const project = await createTestProject();
    await service.generateOutline(project.id);

    const history = await snapshotService.getHistory({
      projectId: project.id,
      entityType: 'outline',
      entityId: project.id,
    });
    expect(history.total).toBeGreaterThanOrEqual(1);
    expect(history.versions[0].source).toBe('ai_generated');
  });

  it('handles missing project gracefully', async () => {
    await expect(service.generateOutline('non-existent-id')).rejects.toThrow('Project not found');
  });

  // ── getOutline ─────────────────────────────────────────────────

  it('returns outline after generation', async () => {
    const project = await createTestProject();
    await service.generateOutline(project.id);

    const outline = await service.getOutline(project.id);
    expect(outline).toBeDefined();
    expect(outline?.world_setting).toBeTruthy();
  });

  it('returns null when no outline exists', async () => {
    const project = await createTestProject();
    const outline = await service.getOutline(project.id);
    expect(outline).toBeNull();
  });

  // ── updateOutline ──────────────────────────────────────────────

  it('merges user edits into existing outline and creates snapshot', async () => {
    const project = await createTestProject();
    await service.generateOutline(project.id);

    const updated = await service.updateOutline(project.id, {
      world_setting: 'An updated futuristic city in 2089.',
    });

    expect(updated.world_setting).toBe('An updated futuristic city in 2089.');
    // Other fields should be preserved
    expect(updated.main_conflict).toBeTruthy();
    expect(updated.characters.length).toBeGreaterThanOrEqual(1);

    // Verify snapshot
    const history = await snapshotService.getHistory({
      projectId: project.id,
      entityType: 'outline',
      entityId: project.id,
    });
    expect(history.total).toBeGreaterThanOrEqual(2);
    expect(history.versions[0].source).toBe('user_edited');
  });

  it('rejects update when no outline exists', async () => {
    const project = await createTestProject();
    await expect(
      service.updateOutline(project.id, { world_setting: 'New setting' })
    ).rejects.toThrow('No existing outline');
  });

  // ── regenerateEpisode ─────────────────────────────────────────

  it('regenerates a single episode without affecting others', async () => {
    const project = await createTestProject();
    const original = await service.generateOutline(project.id);

    const originalEpisode2 = { ...original.episodes[1] };
    const regenerated = await service.regenerateEpisode(project.id, 2);

    // Episode 2 should be different
    expect(regenerated.episodes[1].episode_number).toBe(2);
    // Other episodes should be preserved
    expect(regenerated.episodes[0].episode_number).toBe(1);
    expect(regenerated.episodes.length).toBe(original.episodes.length);
    // World setting preserved
    expect(regenerated.world_setting).toBe(original.world_setting);
  });

  it('throws when episode number does not exist', async () => {
    const project = await createTestProject();
    await service.generateOutline(project.id);

    await expect(service.regenerateEpisode(project.id, 999)).rejects.toThrow('Episode 999 not found');
  });

  // ── validateOutline ───────────────────────────────────────────

  it('returns a validation report with errors, warnings, and passes', async () => {
    const project = await createTestProject();
    await service.generateOutline(project.id);

    const report = await service.validateOutline(project.id);
    expect(report).toBeDefined();
    expect(report.errors).toBeDefined();
    expect(report.warnings).toBeDefined();
    expect(report.passes).toBeDefined();
    expect(typeof report.passed).toBe('boolean');
    expect(report.passes.some((p) => p.type === '服装连续性')).toBe(true);
  });

  it('detects character location contradictions', async () => {
    const project = await createTestProject();
    await service.generateOutline(project.id);

    // Manually inject contradictory data
    await service.updateOutline(project.id, {
      episodes: [
        {
          episode_number: 1,
          title: 'Conflict Test',
          summary: 'Test episode with location conflict',
          key_events: ['Something happens', 'Another thing', 'Third event'],
          featured_characters: ['Hero'],
          featured_locations: ['Beijing', 'Shanghai', 'Shenzhen'], // 3 locations, no transition events
        },
      ],
      episode_count: 1,
    });

    const report = await service.validateOutline(project.id);
    const locationErrors = report.errors.filter((e) => e.type === '角色位置矛盾');
    expect(locationErrors.length).toBeGreaterThanOrEqual(1);
  });

  it('throws when validating non-existent outline', async () => {
    const project = await createTestProject();
    await expect(service.validateOutline(project.id)).rejects.toThrow('No outline to validate');
  });

  // ── confirmOutline ─────────────────────────────────────────────

  it('confirms and locks outline, changes project status to asset_prep', async () => {
    const project = await createTestProject();
    await service.generateOutline(project.id);

    const confirmed = await service.confirmOutline(project.id);
    expect(confirmed).toBeDefined();

    const updated = await testPrisma.projects.findUnique({ where: { id: project.id } });
    expect(updated?.outline_locked).toBe(true);
    expect(updated?.status).toBe('asset_prep');

    // Verify locked snapshot
    const history = await snapshotService.getHistory({
      projectId: project.id,
      entityType: 'outline',
      entityId: project.id,
    });
    const lockedSnap = history.versions.find((v) => v.source === 'locked');
    expect(lockedSnap).toBeDefined();
  });

  it('refuses to confirm when validation errors exist', async () => {
    const project = await createTestProject();
    await service.generateOutline(project.id);

    // Inject contradictory data with many locations to trigger errors
    await service.updateOutline(project.id, {
      episodes: [
        {
          episode_number: 1,
          title: 'Conflict',
          summary: 'Episode with contradictions',
          key_events: ['Start', 'Middle', 'End'],
          featured_characters: ['Hero', 'Villain'],
          featured_locations: ['Location A', 'Location B', 'Location C'], // 3 locations
        },
      ],
      episode_count: 1,
    });

    await expect(service.confirmOutline(project.id)).rejects.toThrow(/Cannot confirm|unresolved errors/);
  });
});
