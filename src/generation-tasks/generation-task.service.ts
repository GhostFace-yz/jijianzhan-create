import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
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
  // Valid state transitions for generation tasks
  private readonly validTransitions: Map<string, GenerationStatus[]> = new Map([
    [GenerationStatus.PENDING, [GenerationStatus.PROCESSING, GenerationStatus.FAILED]],
    [GenerationStatus.PROCESSING, [GenerationStatus.COMPLETED, GenerationStatus.FAILED]],
    [GenerationStatus.COMPLETED, []],
    [GenerationStatus.FAILED, [GenerationStatus.PENDING]], // retry allowed
  ]);

  constructor(private readonly prisma: PrismaService) {}

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
