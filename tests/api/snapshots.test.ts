import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { cleanSnapshots, disconnectTestDb, testPrisma } from '../helpers/prisma.js';
import { createSnapshotService } from '../../src/server/services/snapshot/snapshot-service.js';
import { createChangePropagationService } from '../../src/server/services/snapshot/propagation.js';
import type { EntityRef } from '../../src/server/services/snapshot/types.js';

const service = createSnapshotService({ prisma: testPrisma });

function entity(projectId = 'project-1', entityId = 'outline-1'): EntityRef {
  return { projectId, entityType: 'outline', entityId };
}

describe('version snapshot system', () => {
  beforeEach(async () => {
    await cleanSnapshots();
    await testPrisma.version_counters.deleteMany();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('creates the first snapshot for an entity', async () => {
    const snapshot = await service.createSnapshot({
      entity: entity(),
      source: 'user_edited',
      content: { title: 'My Outline', acts: 3 },
      editedBy: 'user-1',
    });

    expect(snapshot.versionId).toBe('v1');
    expect(snapshot.versionNumber).toBe(1);
    expect(snapshot.source).toBe('user_edited');
    expect(snapshot.content).toEqual({ title: 'My Outline', acts: 3 });
    expect(snapshot.editedBy).toBe('user-1');
    expect(snapshot.parentVersionNumber).toBeNull();
    expect(snapshot.diff).toEqual({});
  });

  it('creates a second snapshot and computes a diff', async () => {
    const ref = entity();

    await service.createSnapshot({ entity: ref, source: 'user_edited', content: { title: 'My Outline', acts: 3 } });

    const snapshot = await service.createSnapshot({
      entity: ref,
      source: 'ai_generated',
      content: { title: 'My Outline', acts: 4, summary: 'New summary' },
      aiModel: { provider: 'openai', model: 'gpt-4o' },
    });

    expect(snapshot.versionId).toBe('v2');
    expect(snapshot.parentVersionNumber).toBe(1);
    expect(snapshot.source).toBe('ai_generated');
    expect(snapshot.diff).toEqual({
      acts: 'changed',
      summary: 'added',
    });
    expect(snapshot.aiModel).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  it('lists version history in descending order without full content', async () => {
    const ref = entity();

    await service.createSnapshot({ entity: ref, source: 'user_edited', content: { v: 1 } });
    await service.createSnapshot({ entity: ref, source: 'ai_generated', content: { v: 2 }, aiModel: { provider: 'openai', model: 'gpt-4o' } });
    await service.createSnapshot({ entity: ref, source: 'user_edited', content: { v: 3 } });

    const history = await service.getHistory(ref);

    expect(history.total).toBe(3);
    expect(history.versions.map((v) => v.versionId)).toEqual(['v3', 'v2', 'v1']);
    expect(history.versions[0]).not.toHaveProperty('content');
    expect(history.versions[1].source).toBe('ai_generated');
    expect(history.versions[1].aiModel).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  it('retrieves a specific snapshot with full content', async () => {
    const ref = entity();

    await service.createSnapshot({ entity: ref, source: 'user_edited', content: { v: 1 } });
    await service.createSnapshot({ entity: ref, source: 'user_edited', content: { v: 2 } });

    const snapshot = await service.getSnapshot(ref, 'v2');

    expect(snapshot).not.toBeNull();
    expect(snapshot?.versionId).toBe('v2');
    expect(snapshot?.content).toEqual({ v: 2 });
    expect(snapshot?.parentVersionNumber).toBe(1);
  });

  it('returns null for an unknown version', async () => {
    const snapshot = await service.getSnapshot(entity(), 'v99');

    expect(snapshot).toBeNull();
  });

  it('compares two snapshots and returns a diff', async () => {
    const ref = entity();

    await service.createSnapshot({ entity: ref, source: 'user_edited', content: { title: 'A', acts: 3 } });
    await service.createSnapshot({ entity: ref, source: 'user_edited', content: { title: 'B', acts: 3, summary: 'S' } });

    const comparison = await service.compareSnapshots(ref, 'v1', 'v2');

    expect(comparison.fromVersionId).toBe('v1');
    expect(comparison.toVersionId).toBe('v2');
    expect(comparison.diff).toEqual({
      title: 'changed',
      summary: 'added',
    });
  });

  it('computes nested diffs with removed fields', async () => {
    const ref = entity();

    await service.createSnapshot({
      entity: ref,
      source: 'user_edited',
      content: { title: 'A', nested: { keep: 1, drop: 2 } },
    });
    const snapshot = await service.createSnapshot({
      entity: ref,
      source: 'user_edited',
      content: { title: 'A', nested: { keep: 1, add: 3 } },
    });

    expect(snapshot.diff).toEqual({
      'nested.drop': 'removed',
      'nested.add': 'added',
    });
  });

  it('creates sequential versions under concurrent writes', async () => {
    const ref = entity();

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        service.createSnapshot({ entity: ref, source: 'user_edited', content: { v: i } })
      )
    );

    const versionNumbers = results.map((r) => r.versionNumber).sort((a, b) => a - b);
    expect(versionNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const history = await service.getHistory(ref);
    expect(history.total).toBe(10);
  });

  it('rolls back to a historical version and triggers propagation callback', async () => {
    const propagated: Array<{ rollbackTargetVersionId: string; newVersionId: string }> = [];
    const rollbackService = createSnapshotService({
      prisma: testPrisma,
      onRollback: async ({ rollbackTargetVersionId, newVersionId }) => {
        propagated.push({ rollbackTargetVersionId, newVersionId });
      },
    });

    const ref = entity();

    await rollbackService.createSnapshot({ entity: ref, source: 'user_edited', content: { v: 1 } });
    await rollbackService.createSnapshot({ entity: ref, source: 'user_edited', content: { v: 2 } });

    const rolledBack = await rollbackService.rollback({ entity: ref, versionId: 'v1', editedBy: 'user-1' });

    expect(rolledBack.versionId).toBe('v3');
    expect(rolledBack.source).toBe('user_edited');
    expect(rolledBack.content).toEqual({ v: 1 });
    expect(rolledBack.editedBy).toBe('user-1');
    expect(propagated).toEqual([{ rollbackTargetVersionId: 'v1', newVersionId: 'v3' }]);

    const history = await rollbackService.getHistory(ref);
    expect(history.versions.map((v) => v.versionId)).toEqual(['v3', 'v2', 'v1']);
  });

  it('records a downstream review flag on rollback', async () => {
    const propagationService = createChangePropagationService({ prisma: testPrisma });
    const rollbackService = createSnapshotService({
      prisma: testPrisma,
      onRollback: propagationService.markDownstreamForReview,
    });

    const ref = entity();
    await rollbackService.createSnapshot({ entity: ref, source: 'user_edited', content: { v: 1 } });
    await rollbackService.createSnapshot({ entity: ref, source: 'user_edited', content: { v: 2 } });

    const rolledBack = await rollbackService.rollback({ entity: ref, versionId: 'v1', editedBy: 'user-1' });

    const flags = await testPrisma.downstream_review_flags.findMany({
      where: {
        project_id: ref.projectId,
        source_entity_type: ref.entityType,
        source_entity_id: ref.entityId,
      },
    });

    expect(flags).toHaveLength(1);
    expect(flags[0].source_version_id).toBe('v1');
    expect(flags[0].new_version_id).toBe(rolledBack.versionId);
    expect(flags[0].status).toBe('pending_review');
  });
});
