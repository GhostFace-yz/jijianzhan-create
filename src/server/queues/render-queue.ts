import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export const RENDER_QUEUE_NAME = 'render-compose';

export interface RenderJobData {
  projectId: string;
  episodeId: string;
  options: Record<string, unknown>;
  plan: unknown;
}

export function createRenderQueue(connection: Redis): Queue<RenderJobData> {
  return new Queue<RenderJobData>(RENDER_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    },
  });
}
