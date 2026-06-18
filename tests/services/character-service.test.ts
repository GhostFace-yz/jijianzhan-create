import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { cleanCharacters, cleanProjects, cleanSnapshots, disconnectTestDb, testPrisma } from '../helpers/prisma.js';
import { AdapterPool } from '../../src/server/adapters/pool.js';
import { MockImageAdapter } from '../../src/server/adapters/providers/mock/mock-image-adapter.js';
import { createCharacterService } from '../../src/server/services/character/character-service.js';
import { createSnapshotService } from '../../src/server/services/snapshot/snapshot-service.js';
import type { CharacterService } from '../../src/server/services/character/types.js';

function createTestServices() {
  const adapterPool = new AdapterPool();
  adapterPool.registerImage(new MockImageAdapter());
  const snapshotService = createSnapshotService({ prisma: testPrisma });
  const service = createCharacterService({
    prisma: testPrisma,
    snapshotService,
    adapterPool,
  });
  return { service, snapshotService };
}

async function createTestProject() {
  return testPrisma.project.create({
    data: {
      user_id: 'system',
      status: 'draft',
      meta: { title: '测试项目' } as never,
    },
  });
}

describe('CharacterService', () => {
  let service: CharacterService;
  let snapshotService: ReturnType<typeof createSnapshotService>;

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

  it('creates a character and returns it', async () => {
    const project = await createTestProject();
    const character = await service.createCharacter(project.id, {
      name: 'Alice',
      role_type: 'protagonist',
      appearance: 'long black hair',
    });

    expect(character.name).toBe('Alice');
    expect(character.role_type).toBe('protagonist');
    expect(character.status).toBe('draft');
    expect(character.project_id).toBe(project.id);
  });

  it('lists characters for a project', async () => {
    const project = await createTestProject();
    await service.createCharacter(project.id, { name: 'A', role_type: 'protagonist' });
    await service.createCharacter(project.id, { name: 'B', role_type: 'supporting' });

    const result = await service.listCharacters(project.id);
    expect(result.total).toBe(2);
    expect(result.characters).toHaveLength(2);
  });

  it('returns null when character is missing', async () => {
    const project = await createTestProject();
    const found = await service.getCharacter(project.id, 'missing-id');
    expect(found).toBeNull();
  });

  it('updates a character and creates a snapshot', async () => {
    const project = await createTestProject();
    const character = await service.createCharacter(project.id, {
      name: 'Alice',
      role_type: 'protagonist',
    });

    const updated = await service.updateCharacter(project.id, character.id, {
      appearance: 'short red hair',
    });
    expect(updated.appearance).toBe('short red hair');

    const history = await snapshotService.getHistory({
      projectId: project.id,
      entityType: 'character',
      entityId: character.id,
    });
    expect(history.total).toBeGreaterThanOrEqual(2);
  });

  it('deletes a character', async () => {
    const project = await createTestProject();
    const character = await service.createCharacter(project.id, {
      name: 'Alice',
      role_type: 'protagonist',
    });

    await service.deleteCharacter(project.id, character.id);
    const found = await service.getCharacter(project.id, character.id);
    expect(found).toBeNull();
  });

  it('auto-creates characters from outline', async () => {
    const project = await createTestProject();
    const characters = await service.autoCreateCharacters(project.id, [
      { name: 'Hero', role_type: 'protagonist' },
      { name: 'Villain', role_type: 'antagonist' },
    ]);

    expect(characters).toHaveLength(2);
    expect(characters[0].name).toBe('Hero');
    expect(characters[1].role_type).toBe('antagonist');
  });

  it('generates three views', async () => {
    const project = await createTestProject();
    const character = await service.createCharacter(project.id, {
      name: 'Alice',
      role_type: 'protagonist',
      appearance: 'long black hair',
      costume: 'red dress',
    });

    const updated = await service.generateViews(project.id, character.id);
    const refImages = updated.ref_images as Array<{ view: string; url: string; seed: number }>;
    expect(refImages).toHaveLength(3);
    expect(refImages.map((i) => i.view).sort()).toEqual(['back', 'front', 'side']);
    expect(refImages[0].url).toMatch(/^https:\/\/mock-cdn\.example\.com\/image\/\d+\.png$/);
  });

  it('retries a single view with a new seed', async () => {
    const project = await createTestProject();
    const character = await service.createCharacter(project.id, {
      name: 'Alice',
      role_type: 'protagonist',
      appearance: 'long black hair',
    });
    const withViews = await service.generateViews(project.id, character.id);
    const before = (withViews.ref_images as Array<{ view: string; url: string; seed: number }>).find(
      (i) => i.view === 'front'
    )!;

    const retried = await service.retryView(project.id, character.id, 'front');
    const after = (retried.ref_images as Array<{ view: string; url: string; seed: number }>).find(
      (i) => i.view === 'front'
    )!;

    expect(after.url).not.toBe(before.url);
    expect(after.seed).not.toBe(before.seed);
  });

  it('confirms views and generates extension refs', async () => {
    const project = await createTestProject();
    const character = await service.createCharacter(project.id, {
      name: 'Alice',
      role_type: 'protagonist',
      appearance: 'long black hair',
    });
    await service.generateViews(project.id, character.id);

    const confirmed = await service.confirmViews(project.id, character.id);
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.ip_adapter_id).toBe(`ipadapter-${character.id}`);

    const refImages = confirmed.ref_images as Array<{ view: string }>;
    expect(refImages).toHaveLength(9);
    const views = refImages.map((i) => i.view);
    expect(views).toContain('front');
    expect(views).toContain('expr_happy');
    expect(views).toContain('scene_standing_casual');
  });

  it('generates extension refs independently', async () => {
    const project = await createTestProject();
    const character = await service.createCharacter(project.id, {
      name: 'Alice',
      role_type: 'protagonist',
      appearance: 'long black hair',
    });
    await service.generateViews(project.id, character.id);

    const updated = await service.generateRefs(project.id, character.id);
    const refImages = updated.ref_images as Array<{ view: string }>;
    expect(refImages).toHaveLength(9);
  });

  it('rolls back to a previous version', async () => {
    const project = await createTestProject();
    const character = await service.createCharacter(project.id, {
      name: 'Alice',
      role_type: 'protagonist',
      appearance: 'long black hair',
    });
    await service.updateCharacter(project.id, character.id, { appearance: 'short red hair' });

    const history = await snapshotService.getHistory({
      projectId: project.id,
      entityType: 'character',
      entityId: character.id,
    });
    const firstVersion = history.versions[history.versions.length - 1].versionId;

    const rolledBack = await service.rollbackCharacter(project.id, character.id, firstVersion);
    expect(rolledBack.appearance).toBe('long black hair');

    const newHistory = await snapshotService.getHistory({
      projectId: project.id,
      entityType: 'character',
      entityId: character.id,
    });
    expect(newHistory.total).toBe(history.total + 1);
  });

  it('throws when project is missing', async () => {
    await expect(
      service.createCharacter('missing-project', { name: 'A', role_type: 'protagonist' })
    ).rejects.toThrow('Project not found');
  });

  it('throws when character is missing', async () => {
    const project = await createTestProject();
    await expect(service.getCharacter(project.id, 'missing-id')).resolves.toBeNull();
    await expect(
      service.updateCharacter(project.id, 'missing-id', { name: 'B' })
    ).rejects.toThrow('Character not found');
  });

  it('throws when confirming without all views', async () => {
    const project = await createTestProject();
    const character = await service.createCharacter(project.id, {
      name: 'Alice',
      role_type: 'protagonist',
    });
    await expect(service.confirmViews(project.id, character.id)).rejects.toThrow('Missing views');
  });
});
