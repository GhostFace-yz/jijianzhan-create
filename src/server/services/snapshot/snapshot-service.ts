import { Prisma, SnapshotSource } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import { computeDiff } from './diff.js';
import type {
  ChangePropagationCallback,
  CreateSnapshotInput,
  DiffResult,
  EntityRef,
  HistoryPagination,
  HistoryResult,
  RollbackInput,
  Snapshot,
  SnapshotService,
} from './types.js';

export interface SnapshotServiceOptions {
  prisma?: typeof prisma;
  onRollback?: ChangePropagationCallback;
}

function toSnapshotMeta(row: {
  id: string;
  version_id: string;
  version_number: number;
  source: SnapshotSource;
  edited_by: string | null;
  ai_model: unknown;
  prompt_override: string | null;
  parent_version_number: number | null;
  created_at: Date;
}): {
  id: string;
  versionId: string;
  versionNumber: number;
  source: SnapshotSource;
  editedBy: string | null;
  aiModel: { provider: string; model: string } | null;
  promptOverride: string | null;
  parentVersionNumber: number | null;
  createdAt: Date;
} {
  const aiModel =
    typeof row.ai_model === 'object' &&
    row.ai_model !== null &&
    'provider' in row.ai_model &&
    'model' in row.ai_model
      ? (row.ai_model as { provider: string; model: string })
      : null;

  return {
    id: row.id,
    versionId: row.version_id,
    versionNumber: row.version_number,
    source: row.source,
    editedBy: row.edited_by,
    aiModel,
    promptOverride: row.prompt_override,
    parentVersionNumber: row.parent_version_number,
    createdAt: row.created_at,
  };
}

function toSnapshot(row: {
  id: string;
  project_id: string;
  entity_type: string;
  entity_id: string;
  version_number: number;
  version_id: string;
  source: SnapshotSource;
  content: unknown;
  parent_version_number: number | null;
  diff: unknown;
  edited_by: string | null;
  ai_model: unknown;
  prompt_override: string | null;
  created_at: Date;
}): Snapshot {
  return {
    ...toSnapshotMeta(row),
    content: row.content as Record<string, unknown>,
    diff: (row.diff as Record<string, 'added' | 'changed' | 'removed'>) ?? {},
  };
}

export function createSnapshotService(options: SnapshotServiceOptions = {}): SnapshotService {
  const db = options.prisma ?? prisma;

  async function allocateVersionNumber(entity: EntityRef): Promise<number> {
    const rows = await db.$queryRaw<{ counter: number }[]>`
      INSERT INTO version_counters (project_id, entity_type, entity_id, counter, updated_at)
      VALUES (${entity.projectId}, ${entity.entityType}, ${entity.entityId}, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(project_id, entity_type, entity_id) DO UPDATE SET counter = counter + 1, updated_at = CURRENT_TIMESTAMP
      RETURNING counter
    `;
    return rows[0].counter;
  }

  async function getParentSnapshot(
    entity: EntityRef,
    versionNumber: number
  ): Promise<{ versionNumber: number; content: Record<string, unknown> } | null> {
    if (versionNumber <= 1) return null;
    const row = await db.version_snapshots.findFirst({
      where: {
        project_id: entity.projectId,
        entity_type: entity.entityType,
        entity_id: entity.entityId,
        version_number: versionNumber - 1,
      },
      select: { version_number: true, content: true },
    });
    return row
      ? { versionNumber: row.version_number, content: row.content as Record<string, unknown> }
      : null;
  }

  return {
    async createSnapshot(input: CreateSnapshotInput): Promise<Snapshot> {
      const nextVersionNumber = await allocateVersionNumber(input.entity);
      const versionId = `v${nextVersionNumber}`;

      const parent = await getParentSnapshot(input.entity, nextVersionNumber);
      const diff = parent ? computeDiff(parent.content, input.content) : {};

      const row = await db.version_snapshots.create({
        data: {
          project_id: input.entity.projectId,
          entity_type: input.entity.entityType,
          entity_id: input.entity.entityId,
          version_number: nextVersionNumber,
          version_id: versionId,
          source: input.source,
          content: input.content as Prisma.InputJsonValue,
          parent_version_number: parent?.versionNumber ?? null,
          diff: diff as Prisma.InputJsonValue,
          edited_by: input.editedBy ?? null,
          ai_model: input.aiModel ? (input.aiModel as unknown as Prisma.InputJsonValue) : undefined,
          prompt_override: input.promptOverride ?? null,
        },
      });

      return toSnapshot(row);
    },

    async getHistory(entity: EntityRef, pagination?: HistoryPagination): Promise<HistoryResult> {
      const where = {
        project_id: entity.projectId,
        entity_type: entity.entityType,
        entity_id: entity.entityId,
      };

      const [total, rows] = await Promise.all([
        db.version_snapshots.count({ where }),
        db.version_snapshots.findMany({
          where,
          orderBy: { version_number: 'desc' },
          skip: pagination?.offset ?? 0,
          take: pagination?.limit ?? 50,
          select: {
            id: true,
            version_id: true,
            version_number: true,
            source: true,
            edited_by: true,
            ai_model: true,
            prompt_override: true,
            parent_version_number: true,
            created_at: true,
          },
        }),
      ]);

      return {
        total,
        versions: rows.map(toSnapshotMeta),
      };
    },

    async getSnapshot(entity: EntityRef, versionId: string): Promise<Snapshot | null> {
      const row = await db.version_snapshots.findFirst({
        where: {
          project_id: entity.projectId,
          entity_type: entity.entityType,
          entity_id: entity.entityId,
          version_id: versionId,
        },
      });

      return row ? toSnapshot(row) : null;
    },

    async compareSnapshots(
      entity: EntityRef,
      fromVersionId: string,
      toVersionId: string
    ): Promise<DiffResult> {
      const [fromSnap, toSnap] = await Promise.all([
        this.getSnapshot(entity, fromVersionId),
        this.getSnapshot(entity, toVersionId),
      ]);

      if (!fromSnap) {
        throw new Error(`Source version ${fromVersionId} not found`);
      }
      if (!toSnap) {
        throw new Error(`Target version ${toVersionId} not found`);
      }

      return {
        fromVersionId,
        toVersionId,
        diff: computeDiff(fromSnap.content, toSnap.content),
      };
    },

    async rollback(input: RollbackInput): Promise<Snapshot> {
      const target = await this.getSnapshot(input.entity, input.versionId);
      if (!target) {
        throw new Error(`Version ${input.versionId} not found`);
      }

      const newSnapshot = await this.createSnapshot({
        entity: input.entity,
        source: 'user_edited',
        content: target.content,
        editedBy: input.editedBy,
      });

      if (options.onRollback) {
        await options.onRollback({
          entity: input.entity,
          rollbackTargetVersionId: input.versionId,
          newVersionId: newSnapshot.versionId,
        });
      }

      return newSnapshot;
    },
  };
}
