import { prisma } from '../../lib/db.js';
import type { EntityRef } from './types.js';

/**
 * 变更传播 payload：回滚操作触发，用于标记下游节点为「需检查」
 */
export interface ChangePropagationPayload {
  entity: EntityRef;
  rollbackTargetVersionId: string;
  newVersionId: string;
}

/**
 * 变更传播服务接口
 */
export interface ChangePropagationService {
  markDownstreamForReview(payload: ChangePropagationPayload): Promise<void>;
}

export interface ChangePropagationOptions {
  prisma?: typeof prisma;
}

/**
 * 创建默认的变更传播服务。
 *
 * v1.0 阶段项目尚未建立完整的下游节点依赖图，因此当前实现将「需检查」
 * 意图记录到 downstream_review_flags 表中，由一致性保障服务（#10）后续
 * 根据依赖关系展开为具体节点并消费。
 */
export function createChangePropagationService(
  options: ChangePropagationOptions = {}
): ChangePropagationService {
  const db = options.prisma ?? prisma;

  return {
    async markDownstreamForReview(payload: ChangePropagationPayload): Promise<void> {
      await db.downstreamReviewFlag.create({
        data: {
          project_id: payload.entity.projectId,
          source_entity_type: payload.entity.entityType,
          source_entity_id: payload.entity.entityId,
          source_version_id: payload.rollbackTargetVersionId,
          new_version_id: payload.newVersionId,
          status: 'pending_review',
        },
      });
    },
  };
}
