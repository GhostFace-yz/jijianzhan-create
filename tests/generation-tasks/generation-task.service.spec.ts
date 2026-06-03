import { Test, TestingModule } from '@nestjs/testing';
import { GenerationTaskService } from '../../src/generation-tasks/generation-task.service';
import { PrismaService } from '../../src/common/prisma.service';
import { QuotaService } from '../../src/common/quota.service';
import { AgnesProvider } from '../../src/generation-tasks/agnes.provider';
import { GenerationStatus, GenerationType } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('GenerationTaskService', () => {
  let service: GenerationTaskService;
  let prisma: PrismaService;

  const mockPrisma = {
    generationTask: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    message: {
      findFirst: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockQuotaService = {
    checkUserQuota: jest.fn(),
    checkGenerationQuota: jest.fn(),
    incrementUsage: jest.fn(),
  };

  const mockAgnesProvider = {
    submitTask: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerationTaskService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QuotaService, useValue: mockQuotaService },
        { provide: AgnesProvider, useValue: mockAgnesProvider },
      ],
    }).compile();

    service = module.get<GenerationTaskService>(GenerationTaskService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create a task with PENDING status', async () => {
      const input = {
        messageId: 'msg-1',
        userId: 'user-1',
        type: GenerationType.VIDEO,
        params: { frame_rate: 24, frame_count: 121 },
      };

      mockPrisma.generationTask.create.mockResolvedValue({
        id: 'task-1',
        ...input,
        status: GenerationStatus.PENDING,
        progress: 0,
      });

      const result = await service.createTask(input);

      expect(mockPrisma.generationTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          messageId: 'msg-1',
          userId: 'user-1',
          type: GenerationType.VIDEO,
          status: GenerationStatus.PENDING,
          progress: 0,
        }),
      });
      expect(result.status).toBe(GenerationStatus.PENDING);
    });
  });

  describe('getTask', () => {
    it('should return task if found and owned by user', async () => {
      const task = {
        id: 'task-1',
        userId: 'user-1',
        status: GenerationStatus.PENDING,
      };
      mockPrisma.generationTask.findFirst.mockResolvedValue(task);

      const result = await service.getTask('task-1', 'user-1');

      expect(result).toEqual(task);
      expect(mockPrisma.generationTask.findFirst).toHaveBeenCalledWith({
        where: { id: 'task-1', userId: 'user-1' },
      });
    });

    it('should throw NotFoundException if task not found', async () => {
      mockPrisma.generationTask.findFirst.mockResolvedValue(null);

      await expect(service.getTask('task-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('transitionStatus', () => {
    it('should allow PENDING → PROCESSING', async () => {
      mockPrisma.generationTask.findUnique.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.PENDING,
      });
      mockPrisma.generationTask.update.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.PROCESSING,
        progress: 10,
        providerTaskId: 'provider-123',
      });

      const result = await service.transitionStatus(
        'task-1',
        GenerationStatus.PROCESSING,
        { progress: 10, providerTaskId: 'provider-123' },
      );

      expect(result.status).toBe(GenerationStatus.PROCESSING);
      expect(mockPrisma.generationTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: GenerationStatus.PROCESSING,
          progress: 10,
          providerTaskId: 'provider-123',
          updatedAt: expect.any(Date),
        }),
      });
    });

    it('should allow PROCESSING → COMPLETED', async () => {
      mockPrisma.generationTask.findUnique.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.PROCESSING,
      });
      mockPrisma.generationTask.update.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.COMPLETED,
        resultUrl: 'https://cdn.example.com/video.mp4',
      });

      const result = await service.transitionStatus(
        'task-1',
        GenerationStatus.COMPLETED,
        { resultUrl: 'https://cdn.example.com/video.mp4' },
      );

      expect(result.status).toBe(GenerationStatus.COMPLETED);
      expect(result.resultUrl).toBe('https://cdn.example.com/video.mp4');
    });

    it('should allow PROCESSING → FAILED', async () => {
      mockPrisma.generationTask.findUnique.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.PROCESSING,
      });
      mockPrisma.generationTask.update.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.FAILED,
        errorMessage: 'Generation timeout',
      });

      const result = await service.transitionStatus(
        'task-1',
        GenerationStatus.FAILED,
        { errorMessage: 'Generation timeout' },
      );

      expect(result.status).toBe(GenerationStatus.FAILED);
      expect(result.errorMessage).toBe('Generation timeout');
    });

    it('should allow FAILED → PENDING (retry)', async () => {
      mockPrisma.generationTask.findUnique.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.FAILED,
      });
      mockPrisma.generationTask.update.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.PENDING,
      });

      const result = await service.transitionStatus(
        'task-1',
        GenerationStatus.PENDING,
      );

      expect(result.status).toBe(GenerationStatus.PENDING);
    });

    it('should reject invalid transitions', async () => {
      mockPrisma.generationTask.findUnique.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.COMPLETED,
      });

      await expect(
        service.transitionStatus('task-1', GenerationStatus.PENDING),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject PENDING → COMPLETED (must go through PROCESSING)', async () => {
      mockPrisma.generationTask.findUnique.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.PENDING,
      });

      await expect(
        service.transitionStatus('task-1', GenerationStatus.COMPLETED),
      ).rejects.toThrow(BadRequestException);
    });

    it('should clamp progress between 0 and 100', async () => {
      mockPrisma.generationTask.findUnique.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.PROCESSING,
      });
      mockPrisma.generationTask.update.mockResolvedValue({
        id: 'task-1',
        progress: 100,
      });

      await service.transitionStatus('task-1', GenerationStatus.COMPLETED, {
        progress: 150,
      });

      expect(mockPrisma.generationTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ progress: 100 }),
        }),
      );
    });

    it('should clear error message when transitioning away from FAILED', async () => {
      mockPrisma.generationTask.findUnique.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.FAILED,
        errorMessage: 'Old error',
      });
      mockPrisma.generationTask.update.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.PENDING,
        errorMessage: null,
      });

      await service.transitionStatus('task-1', GenerationStatus.PENDING);

      expect(mockPrisma.generationTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ errorMessage: null }),
        }),
      );
    });

    it('should throw NotFoundException if task does not exist', async () => {
      mockPrisma.generationTask.findUnique.mockResolvedValue(null);

      await expect(
        service.transitionStatus('task-1', GenerationStatus.PROCESSING),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('retryTask', () => {
    it('should reset failed task to PENDING', async () => {
      mockPrisma.generationTask.findFirst.mockResolvedValue({
        id: 'task-1',
        userId: 'user-1',
        status: GenerationStatus.FAILED,
      });
      mockPrisma.generationTask.update.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.PENDING,
        progress: 0,
        errorMessage: null,
        resultUrl: null,
        providerTaskId: null,
      });

      const result = await service.retryTask('task-1', 'user-1');

      expect(result.status).toBe(GenerationStatus.PENDING);
      expect(mockPrisma.generationTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: GenerationStatus.PENDING,
          progress: 0,
          errorMessage: null,
          resultUrl: null,
          providerTaskId: null,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should throw BadRequestException if task is not failed', async () => {
      mockPrisma.generationTask.findFirst.mockResolvedValue({
        id: 'task-1',
        userId: 'user-1',
        status: GenerationStatus.COMPLETED,
      });

      await expect(service.retryTask('task-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if task not found', async () => {
      mockPrisma.generationTask.findFirst.mockResolvedValue(null);

      await expect(service.retryTask('task-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('handleWebhookCallback', () => {
    it('should update task status on valid callback', async () => {
      mockPrisma.generationTask.findFirst.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.PROCESSING,
      });
      mockPrisma.generationTask.findUnique.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.PROCESSING,
      });
      mockPrisma.generationTask.update.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.COMPLETED,
        resultUrl: 'https://cdn.example.com/video.mp4',
      });

      const result = await service.handleWebhookCallback(
        'provider-task-123',
        GenerationStatus.COMPLETED,
        'https://cdn.example.com/video.mp4',
      );

      expect(result.status).toBe(GenerationStatus.COMPLETED);
      expect(mockPrisma.generationTask.findFirst).toHaveBeenCalledWith({
        where: { providerTaskId: 'provider-task-123' },
      });
    });

    it('should map external status strings to internal status', async () => {
      mockPrisma.generationTask.findFirst.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.PROCESSING,
      });
      mockPrisma.generationTask.findUnique.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.PROCESSING,
      });
      mockPrisma.generationTask.update.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.FAILED,
        errorMessage: 'Error',
      });

      await service.handleWebhookCallback(
        'provider-task-123',
        'ERROR' as GenerationStatus,
        undefined,
        'Something went wrong',
      );

      expect(mockPrisma.generationTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: GenerationStatus.FAILED,
            errorMessage: 'Something went wrong',
          }),
        }),
      );
    });

    it('should throw NotFoundException if provider task ID not found', async () => {
      mockPrisma.generationTask.findFirst.mockResolvedValue(null);

      await expect(
        service.handleWebhookCallback('unknown-task', GenerationStatus.COMPLETED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getValidTransitions', () => {
    it('should return correct transitions for each status', () => {
      expect(service.getValidTransitions(GenerationStatus.PENDING)).toEqual([
        GenerationStatus.PROCESSING,
        GenerationStatus.FAILED,
      ]);
      expect(service.getValidTransitions(GenerationStatus.PROCESSING)).toEqual([
        GenerationStatus.COMPLETED,
        GenerationStatus.FAILED,
      ]);
      expect(service.getValidTransitions(GenerationStatus.COMPLETED)).toEqual([]);
      expect(service.getValidTransitions(GenerationStatus.FAILED)).toEqual([
        GenerationStatus.PENDING,
      ]);
    });
  });
});
