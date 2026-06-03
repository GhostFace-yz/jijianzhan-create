import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { QuotaService } from '../common/quota.service';
import { AgnesProvider } from './agnes.provider';
import { GenerationStatus, GenerationType, Prisma } from '@prisma/client';

export interface CreateTaskInput {
  messageId: string;
  userId: string;
  type: GenerationType;
  params?: Record<string, unknown>;
}

export interface TaskStateTransition {
  from: GenerationStatus;
  to: GenerationStatus;
  allowed: boolean;
}

@Injectable()
export class GenerationTaskService {
  private readonly logger = new Logger(GenerationTaskService.name);

  // Valid state transitions for generation tasks
  private readonly validTransitions: Map<string, GenerationStatus[]> = new Map([
    [GenerationStatus.PENDING, [GenerationStatus.PROCESSING, GenerationStatus.FAILED]],
    [GenerationStatus.PROCESSING, [GenerationStatus.COMPLETED, GenerationStatus.FAILED]],
    [GenerationStatus.COMPLETED, []],
    [GenerationStatus.FAILED, [GenerationStatus.PENDING]], // retry allowed
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotaService: QuotaService,
    private readonly agnesProvider: AgnesProvider,
  ) {}

  async submitTask(input: CreateTaskInput) {
    // 1. Verify message ownership
    const message = await this.prisma.message.findFirst({
      where: {
        id: input.messageId,
        session: {
          userId: input.userId,
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found or does not belong to user');
    }

    // 2. Check quota
    const quotaResult = await this.quotaService.checkGenerationQuota(
      input.userId,
      input.type,
    );

    // 3. Create local task
    const task = await this.prisma.generationTask.create({
      data: {
        messageId: input.messageId,
        userId: input.userId,
        type: input.type,
        status: GenerationStatus.PENDING,
        params: input.params
          ? (input.params as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        progress: 0,
      },
    });

    // 4. Submit to Agnes AI
    try {
      const prompt =
        typeof input.params?.prompt === 'string'
          ? input.params.prompt
          : message.content;

      if (input.type === GenerationType.IMAGE) {
        // Image generation is synchronous
        const referenceImages =
          Array.isArray(input.params?.referenceImages)
            ? (input.params.referenceImages as string[])
            : undefined;

        const imageResult = await this.agnesProvider.submitImageTask({
          prompt,
          size: typeof input.params?.size === 'string' ? input.params.size : undefined,
          referenceImages,
        });

        // 5. Mark as completed immediately with the result URL
        const completedTask = await this.transitionStatus(
          task.id,
          GenerationStatus.COMPLETED,
          {
            resultUrl: imageResult.url,
            progress: 100,
          },
        );

        // 6. Increment usage
        await this.quotaService.incrementUsage(quotaResult.subscription.id);

        return completedTask;
      } else {
        // Video generation is asynchronous
        const videoParams: Parameters<AgnesProvider['submitVideoTask']>[0] = {
          prompt,
        };

        // Map frontend params to Agnes video params
        if (input.params?.height !== undefined) videoParams.height = input.params.height as number;
        if (input.params?.width !== undefined) videoParams.width = input.params.width as number;
        if (input.params?.numFrames !== undefined) videoParams.numFrames = input.params.numFrames as number;
        if (input.params?.frameRate !== undefined) videoParams.frameRate = input.params.frameRate as number;
        if (input.params?.negativePrompt !== undefined) videoParams.negativePrompt = input.params.negativePrompt as string;
        if (input.params?.image !== undefined) videoParams.image = input.params.image as string;

        const videoResult = await this.agnesProvider.submitVideoTask(videoParams);

        // 5. Update task with provider task ID and transition to PROCESSING
        const updatedTask = await this.transitionStatus(
          task.id,
          GenerationStatus.PROCESSING,
          {
            providerTaskId: videoResult.taskId,
          },
        );

        // 6. Increment usage
        await this.quotaService.incrementUsage(quotaResult.subscription.id);

        return updatedTask;
      }
    } catch (err: any) {
      // Mark task as failed if Agnes submission fails
      this.logger.error(
        `Failed to submit task to Agnes: ${err.message}`,
        err.stack,
      );
      await this.transitionStatus(task.id, GenerationStatus.FAILED, {
        errorMessage: err.message ?? 'Failed to submit to generation provider',
      });
      throw err;
    }
  }

  async resubmitToAgnes(taskId: string, userId: string) {
    const task = await this.prisma.generationTask.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new NotFoundException('Generation task not found');
    }

    if (task.status !== GenerationStatus.PENDING) {
      throw new BadRequestException('Task must be in PENDING status to resubmit');
    }

    const params = (task.params as Record<string, unknown>) ?? {};
    const prompt = typeof params.prompt === 'string' ? params.prompt : '';

    try {
      if (task.type === GenerationType.IMAGE) {
        const referenceImages = Array.isArray(params.referenceImages)
          ? (params.referenceImages as string[])
          : undefined;

        const imageResult = await this.agnesProvider.submitImageTask({
          prompt,
          size: typeof params.size === 'string' ? params.size : undefined,
          referenceImages,
        });

        return this.transitionStatus(
          task.id,
          GenerationStatus.COMPLETED,
          {
            resultUrl: imageResult.url,
            progress: 100,
          },
        );
      } else {
        const videoParams: Parameters<AgnesProvider['submitVideoTask']>[0] = { prompt };
        if (params.height !== undefined) videoParams.height = params.height as number;
        if (params.width !== undefined) videoParams.width = params.width as number;
        if (params.numFrames !== undefined) videoParams.numFrames = params.numFrames as number;
        if (params.frameRate !== undefined) videoParams.frameRate = params.frameRate as number;
        if (params.negativePrompt !== undefined) videoParams.negativePrompt = params.negativePrompt as string;
        if (params.image !== undefined) videoParams.image = params.image as string;

        const videoResult = await this.agnesProvider.submitVideoTask(videoParams);

        return this.transitionStatus(task.id, GenerationStatus.PROCESSING, {
          providerTaskId: videoResult.taskId,
        });
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to resubmit task to Agnes: ${err.message}`,
        err.stack,
      );
      await this.transitionStatus(task.id, GenerationStatus.FAILED, {
        errorMessage: err.message ?? 'Failed to resubmit to generation provider',
      });
      throw err;
    }
  }

  async pollVideoTask(taskId: string, userId: string) {
    const task = await this.prisma.generationTask.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new NotFoundException('Generation task not found');
    }

    if (task.type !== GenerationType.VIDEO) {
      throw new BadRequestException('Polling is only supported for video tasks');
    }

    if (!task.providerTaskId) {
      throw new BadRequestException('Video task has not been submitted to Agnes yet');
    }

    const queryResult = await this.agnesProvider.queryVideoTask(task.providerTaskId);

    // Map Agnes status to internal status
    const agnesStatus = queryResult.status.toUpperCase();
    let newStatus: GenerationStatus | undefined;
    let resultUrl: string | undefined;
    let errorMessage: string | undefined;
    let progress: number | undefined;

    if (agnesStatus === 'COMPLETED' || agnesStatus === 'SUCCESS' || agnesStatus === 'DONE') {
      newStatus = GenerationStatus.COMPLETED;
      resultUrl = queryResult.videoUrl;
      progress = 100;
    } else if (agnesStatus === 'FAILED' || agnesStatus === 'ERROR') {
      newStatus = GenerationStatus.FAILED;
      errorMessage = queryResult.errorMessage ?? 'Video generation failed';
    } else {
      // PROCESSING, PENDING, etc.
      newStatus = GenerationStatus.PROCESSING;
      progress = queryResult.progress ?? task.progress ?? 0;
    }

    // Only update if status changed or progress updated
    if (
      newStatus !== task.status ||
      progress !== undefined ||
      resultUrl !== undefined ||
      errorMessage !== undefined
    ) {
      return this.transitionStatus(task.id, newStatus, {
        resultUrl,
        errorMessage,
        progress,
      });
    }

    return task;
  }

  async createTask(input: CreateTaskInput) {
    return this.prisma.generationTask.create({
      data: {
        messageId: input.messageId,
        userId: input.userId,
        type: input.type,
        status: GenerationStatus.PENDING,
        params: input.params ? (input.params as Prisma.InputJsonValue) : Prisma.JsonNull,
        progress: 0,
      },
    });
  }

  async getTask(id: string, userId: string) {
    const task = await this.prisma.generationTask.findFirst({
      where: { id, userId },
    });

    if (!task) {
      throw new NotFoundException('Generation task not found');
    }

    return task;
  }

  async getTaskByProviderTaskId(providerTaskId: string) {
    return this.prisma.generationTask.findFirst({
      where: { providerTaskId },
    });
  }

  async transitionStatus(
    id: string,
    newStatus: GenerationStatus,
    options?: {
      resultUrl?: string;
      errorMessage?: string;
      progress?: number;
      providerTaskId?: string;
    },
  ) {
    const task = await this.prisma.generationTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Generation task not found');
    }

    const allowedNext = this.validTransitions.get(task.status) ?? [];
    if (!allowedNext.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid state transition from ${task.status} to ${newStatus}`,
      );
    }

    const updateData: Prisma.GenerationTaskUpdateInput = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (options?.resultUrl !== undefined) {
      updateData.resultUrl = options.resultUrl;
    }

    if (options?.errorMessage !== undefined) {
      updateData.errorMessage = options.errorMessage;
    }

    if (options?.progress !== undefined) {
      updateData.progress = Math.min(100, Math.max(0, options.progress));
    }

    if (options?.providerTaskId !== undefined) {
      updateData.providerTaskId = options.providerTaskId;
    }

    // Clear error message on successful transition away from FAILED
    if (newStatus !== GenerationStatus.FAILED) {
      updateData.errorMessage = null;
    }

    return this.prisma.generationTask.update({
      where: { id },
      data: updateData,
    });
  }

  async retryTask(id: string, userId: string) {
    const task = await this.prisma.generationTask.findFirst({
      where: { id, userId },
    });

    if (!task) {
      throw new NotFoundException('Generation task not found');
    }

    if (task.status !== GenerationStatus.FAILED) {
      throw new BadRequestException('Only failed tasks can be retried');
    }

    return this.prisma.generationTask.update({
      where: { id },
      data: {
        status: GenerationStatus.PENDING,
        progress: 0,
        errorMessage: null,
        resultUrl: null,
        providerTaskId: null,
        updatedAt: new Date(),
      },
    });
  }

  async handleWebhookCallback(
    providerTaskId: string,
    status: GenerationStatus,
    resultUrl?: string,
    errorMessage?: string,
  ) {
    const task = await this.getTaskByProviderTaskId(providerTaskId);

    if (!task) {
      throw new NotFoundException('Task not found for provider task ID');
    }

    // Map external status to internal status if needed
    const internalStatus = this.mapExternalStatus(status);

    return this.transitionStatus(task.id, internalStatus, {
      resultUrl,
      errorMessage,
    });
  }

  async listUserTasks(userId: string, status?: GenerationStatus) {
    return this.prisma.generationTask.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private mapExternalStatus(status: GenerationStatus | string): GenerationStatus {
    const normalized = String(status).toUpperCase();
    switch (normalized) {
      case 'COMPLETED':
      case 'SUCCESS':
      case 'DONE':
        return GenerationStatus.COMPLETED;
      case 'FAILED':
      case 'ERROR':
      case 'FAILURE':
        return GenerationStatus.FAILED;
      case 'PROCESSING':
      case 'RUNNING':
      case 'IN_PROGRESS':
        return GenerationStatus.PROCESSING;
      case 'PENDING':
      case 'QUEUED':
      case 'SUBMITTED':
      default:
        return GenerationStatus.PENDING;
    }
  }

  getValidTransitions(fromStatus: GenerationStatus): GenerationStatus[] {
    return this.validTransitions.get(fromStatus) ?? [];
  }
}
