import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  cleanProjects,
  cleanSnapshots,
  disconnectTestDb,
  testPrisma,
} from '../helpers/prisma.js';
import { AdapterPool } from '../../src/server/adapters/pool.js';
import { MockImageAdapter } from '../../src/server/adapters/providers/mock/mock-image-adapter.js';
import { createSceneBibleService } from '../../src/server/services/scene-bible/scene-bible-service.js';
import { createSnapshotService } from '../../src/server/services/snapshot/snapshot-service.js';

function createTestServices() {
  const adapterPool = new AdapterPool();
  adapterPool.registerImage(new MockImageAdapter());
  const snapshotService = createSnapshotService({ prisma: testPrisma });
  const service = createSceneBibleService({
    prisma: testPrisma,
    snapshotService,
    adapterPool,
  });
  return { service, snapshotService };
}

async function createTestProject(meta: Record<string, unknown> = {}) {
  return testPrisma.projects.create({
    data: {
      user_id: 'system',
      status: 'draft',
      meta: { title: 'Test Project', ...meta } as never,
    },
  });
}

describe('SceneBibleService', () => {
  let service: ReturnType<typeof createTestServices>['service'];
  let snapshotService: ReturnType<typeof createTestServices>['snapshotService'];

  beforeEach(async () => {
    await cleanProjects();
    await cleanSnapshots();
    const services = createTestServices();
    service = services.service;
    snapshotService = services.snapshotService;
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('syncs locations from project outline', async () => {
    const project = await createTestProject({
      locations: [
        { name: 'Cafe', description: 'A cozy coffee shop' },
        'Park',
      ],
    });

    const locations = await service.syncScenesFromOutline(project.id);

    expect(locations).toHaveLength(2);
    expect(locations[0].name).toBe('Cafe');
    expect(locations[0].description).toBe('A cozy coffee shop');
    expect(locations[1].name).toBe('Park');
  });

  it('upserts locations by name on sync', async () => {
    const project = await createTestProject({
      locations: [{ name: 'Cafe', description: 'Old description' }],
    });
    await service.syncScenesFromOutline(project.id);

    await testPrisma.projects.update({
      where: { id: project.id },
      data: {
        meta: { title: 'Test Project', locations: [{ name: 'Cafe', description: 'New description' }] } as never,
      },
    });
    const locations = await service.syncScenesFromOutline(project.id);

    expect(locations).toHaveLength(1);
    expect(locations[0].description).toBe('New description');
  });

  it('lists scenes for a project', async () => {
    const project = await createTestProject();
    await service.createScene(project.id, { name: 'Cafe' });
    await service.createScene(project.id, { name: 'Park' });

    const result = await service.listScenes(project.id);

    expect(result.total).toBe(2);
    expect(result.locations.map((l) => l.name).sort()).toEqual(['Cafe', 'Park']);
  });

  it('returns null for missing scene', async () => {
    const project = await createTestProject();
    const scene = await service.getScene(project.id, 'non-existent-id');
    expect(scene).toBeNull();
  });

  it('updates scene fields and creates snapshot', async () => {
    const project = await createTestProject();
    const location = await service.createScene(project.id, { name: 'Cafe' });

    const updated = await service.updateScene(project.id, location.id, {
      description: 'A cozy place',
      lighting_type: 'soft ambient',
    });

    expect(updated.description).toBe('A cozy place');
    expect(updated.lighting_type).toBe('soft ambient');

    const history = await snapshotService.getHistory({
      projectId: project.id,
      entityType: 'location',
      entityId: location.id,
    });
    expect(history.total).toBeGreaterThanOrEqual(2);
  });

  it('throws when project not found', async () => {
    await expect(service.listScenes('non-existent-id')).rejects.toThrow('Project not found');
  });

  it('throws when location not found', async () => {
    const project = await createTestProject();
    await expect(
      service.updateScene(project.id, 'non-existent-id', { name: 'X' })
    ).rejects.toThrow('Location not found');
  });

  it('generates 3 base candidates with distinct seeds', async () => {
    const project = await createTestProject();
    const location = await service.createScene(project.id, {
      name: 'Cafe',
      description: 'A cozy coffee shop',
      lighting_type: 'warm',
      style: 'vintage',
    });

    const candidates = await service.generateBaseCandidates(project.id, location.id);

    expect(candidates).toHaveLength(3);
    const seeds = candidates.map((c) => c.seed);
    expect(new Set(seeds).size).toBe(3);
    expect(candidates[0].prompt).toContain('no people, no characters, empty room');
    expect(candidates[0].prompt).toContain('architectural photography');
  });

  it('uses provided seed for base candidates deterministically', async () => {
    const project = await createTestProject();
    const location = await service.createScene(project.id, { name: 'Cafe' });

    const first = await service.generateBaseCandidates(project.id, location.id, { seed: 12345 });
    const second = await service.generateBaseCandidates(project.id, location.id, { seed: 12345 });

    expect(first.map((c) => c.seed)).toEqual(second.map((c) => c.seed));
    expect(first.map((c) => c.url)).toEqual(second.map((c) => c.url));
  });

  it('confirms base image and triggers snapshot', async () => {
    const project = await createTestProject();
    const location = await service.createScene(project.id, { name: 'Cafe' });

    const confirmed = await service.confirmBase(project.id, location.id, {
      url: 'https://example.com/base.png',
      seed: 12345,
      prompt: 'base prompt',
    });

    expect(confirmed.base_seed).toBe(12345);
    expect(confirmed.base_image_url).toBe('https://example.com/base.png');

    const history = await snapshotService.getHistory({
      projectId: project.id,
      entityType: 'location',
      entityId: location.id,
    });
    expect(history.total).toBeGreaterThanOrEqual(2);
  });

  it('reuses deterministic seed for same variant inputs', async () => {
    const project = await createTestProject();
    const location = await service.createScene(project.id, { name: 'Cafe' });
    await service.confirmBase(project.id, location.id, {
      url: 'https://example.com/base.png',
      seed: 1000,
      prompt: 'base',
    });

    const v1 = await service.generateVariant(project.id, location.id, {
      time_of_day: 'morning',
      weather: 'rainy',
    });
    const v2 = await service.generateVariant(project.id, location.id, {
      time_of_day: 'morning',
      weather: 'rainy',
    });

    expect(v1.seed).toBe(v2.seed);
    expect(v1.url).toBe(v2.url);
    expect(v1.prompt).toContain('morning');
    expect(v1.prompt).toContain('rainy');
  });

  it('throws when generating variant without confirmed base', async () => {
    const project = await createTestProject();
    const location = await service.createScene(project.id, { name: 'Cafe' });

    await expect(
      service.generateVariant(project.id, location.id, {
        time_of_day: 'morning',
        weather: 'rainy',
      })
    ).rejects.toThrow('Base image not confirmed');
  });

  it('confirms variant and stores exact seed', async () => {
    const project = await createTestProject();
    const location = await service.createScene(project.id, { name: 'Cafe' });
    await service.confirmBase(project.id, location.id, {
      url: 'https://example.com/base.png',
      seed: 1000,
      prompt: 'base',
    });

    const variant = await service.generateVariant(project.id, location.id, {
      time_of_day: 'night',
      weather: 'clear',
    });
    const confirmed = await service.confirmVariant(project.id, location.id, {
      time_of_day: 'night',
      weather: 'clear',
      variant,
    });

    const variants = confirmed.variants as Record<string, { seed: number; image_url: string }>;
    expect(variants['night-clear'].seed).toBe(variant.seed);
    expect(variants['night-clear'].image_url).toBe(variant.url);

    const history = await snapshotService.getHistory({
      projectId: project.id,
      entityType: 'location',
      entityId: location.id,
    });
    expect(history.total).toBeGreaterThanOrEqual(3);
  });

  it('returns history for a scene', async () => {
    const project = await createTestProject();
    const location = await service.createScene(project.id, { name: 'Cafe' });

    const history = await service.getSceneHistory(project.id, location.id);
    expect(history.total).toBe(1);
  });

  it('rolls back to a previous version', async () => {
    const project = await createTestProject();
    const location = await service.createScene(project.id, { name: 'Cafe' });
    await service.updateScene(project.id, location.id, { description: 'Updated' });

    const history = await service.getSceneHistory(project.id, location.id);
    const firstVersion = history.versions[history.versions.length - 1];

    const rolledBack = await service.rollbackScene(project.id, location.id, firstVersion.versionId);
    expect(rolledBack.description).toBeNull();
  });
});
