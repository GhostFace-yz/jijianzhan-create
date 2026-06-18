import type { SnapshotSource } from '@prisma/client';

/**
 * 可编辑实体类型
 */
export type EntityType =
  | 'project'
  | 'outline'
  | 'character'
  | 'scene'
  | 'script'
  | 'node'
  | 'generation_result'
  | 'location';

/**
 * 实体引用
 */
export interface EntityRef {
  projectId: string;
  entityType: EntityType;
  entityId: string;
}

/**
 * AI 模型信息
 */
export interface AIModelInfo {
  provider: string;
  model: string;
}

/**
 * 创建快照输入
 */
export interface CreateSnapshotInput {
  entity: EntityRef;
  source: SnapshotSource;
  content: Record<string, unknown>;
  editedBy?: string;
  aiModel?: AIModelInfo;
  promptOverride?: string;
}

/**
 * 快照元数据（不含完整 content，用于历史列表）
 */
export interface SnapshotMeta {
  id: string;
  versionId: string;
  versionNumber: number;
  source: SnapshotSource;
  editedBy: string | null;
  aiModel: AIModelInfo | null;
  promptOverride: string | null;
  parentVersionNumber: number | null;
  createdAt: Date;
}

/**
 * 完整快照
 */
export interface Snapshot extends SnapshotMeta {
  content: Record<string, unknown>;
  diff: Record<string, DiffOp>;
}

/**
 * Diff 操作类型
 */
export type DiffOp = 'added' | 'changed' | 'removed';

/**
 * Diff 结果
 */
export interface DiffResult {
  fromVersionId: string;
  toVersionId: string;
  diff: Record<string, DiffOp>;
}

/**
 * 回滚输入
 */
export interface RollbackInput {
  entity: EntityRef;
  versionId: string;
  editedBy?: string;
}

/**
 * 变更传播回调：快照服务在回滚后调用，由业务模块注册具体实现
 */
export type ChangePropagationCallback = (payload: {
  entity: EntityRef;
  rollbackTargetVersionId: string;
  newVersionId: string;
}) => Promise<void> | void;

/**
 * 历史查询分页参数
 */
export interface HistoryPagination {
  limit?: number;
  offset?: number;
}

/**
 * 历史查询结果
 */
export interface HistoryResult {
  total: number;
  versions: SnapshotMeta[];
}

/**
 * 版本快照服务接口
 */
export interface SnapshotService {
  createSnapshot(input: CreateSnapshotInput): Promise<Snapshot>;
  getHistory(entity: EntityRef, pagination?: HistoryPagination): Promise<HistoryResult>;
  getSnapshot(entity: EntityRef, versionId: string): Promise<Snapshot | null>;
  compareSnapshots(
    entity: EntityRef,
    fromVersionId: string,
    toVersionId: string
  ): Promise<DiffResult>;
  rollback(input: RollbackInput): Promise<Snapshot>;
}
