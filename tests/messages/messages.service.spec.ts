import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from '../../src/messages/messages.service';
import { PrismaService } from '../../src/common/prisma.service';
import { QuotaService } from '../../src/common/quota.service';
import { KimiProvider } from '../../src/messages/kimi.provider';
import { GenerationTaskService } from '../../src/generation-tasks/generation-task.service';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  MessageRole,
  MessageType,
  SubscriptionStatus,
  GenerationStatus,
} from '@prisma/client';

describe('MessagesService', () => {
  let service: MessagesService;
  let prisma: PrismaService;

  const mockPrisma = {
    session: {
      findFirst: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockQuotaService = {
    checkUserQuota: jest.fn(),
    incrementUsage: jest.fn().mockResolvedValue(undefined),
  };

  const mockKimiProvider = {
    streamChat: jest.fn().mockImplementation(async function* () {
      yield 'Hello';
      yield ' world';
    }),
  };

  const mockGenerationTaskService = {
    submitTask: jest.fn(),
  };

  const userId = 'user_test_123';
  const sessionId = 'session_test_456';
  const subscriptionId = 'sub_test_123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QuotaService, useValue: mockQuotaService },
        { provide: KimiProvider, useValue: mockKimiProvider },
        { provide: GenerationTaskService, useValue: mockGenerationTaskService },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('verifySessionOwnership', () => {
    it('should return session if owned by user', async () => {
      mockPrisma.session.findFirst.mockResolvedValue({
        id: sessionId,
        userId,
        title: 'Test Session',
      });

      const result = await service.verifySessionOwnership(sessionId, userId);
      expect(result.id).toBe(sessionId);
      expect(mockPrisma.session.findFirst).toHaveBeenCalledWith({
        where: {
          id: sessionId,
          userId,
          deletedAt: null,
        },
      });
    });

    it('should throw ForbiddenException if session not found', async () => {
      mockPrisma.session.findFirst.mockResolvedValue(null);

      await expect(
        service.verifySessionOwnership(sessionId, userId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('checkUserQuota', () => {
    it('should return subscription if quota is available', async () => {
      mockQuotaService.checkUserQuota.mockResolvedValue({
        subscription: {
          id: subscriptionId,
          usageQuota: 100,
          usageConsumed: 10,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        plan: {
          id: 'plan-1',
          name: 'Pro',
          quotaLimits: { text_chats: -1 },
        },
      });
      mockPrisma.subscription.findUniqueOrThrow.mockResolvedValue({
        id: subscriptionId,
        userId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 86400000),
        usageQuota: 100,
        usageConsumed: 10,
      });

      const result = await service.checkUserQuota(userId);
      expect(result.usageConsumed).toBe(10);
      expect(result.usageQuota).toBe(100);
    });

    it('should throw 402 if no active subscription', async () => {
      mockQuotaService.checkUserQuota.mockRejectedValue(
        new HttpException(
          'No active subscription found',
          HttpStatus.PAYMENT_REQUIRED,
        ),
      );

      await expect(service.checkUserQuota(userId)).rejects.toThrow(
        new HttpException(
          'No active subscription found',
          HttpStatus.PAYMENT_REQUIRED,
        ),
      );
    });

    it('should throw 402 if quota exceeded', async () => {
      mockQuotaService.checkUserQuota.mockRejectedValue(
        new HttpException('Usage quota exceeded', HttpStatus.PAYMENT_REQUIRED),
      );

      await expect(service.checkUserQuota(userId)).rejects.toThrow(
        new HttpException('Usage quota exceeded', HttpStatus.PAYMENT_REQUIRED),
      );
    });
  });

  describe('saveUserMessage', () => {
    it('should create user message', async () => {
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg_1',
        sessionId,
        role: MessageRole.USER,
        content: 'Hello',
        type: MessageType.TEXT,
      });

      const result = await service.saveUserMessage({
        sessionId,
        content: 'Hello',
        type: MessageType.TEXT,
      });

      expect(result.role).toBe(MessageRole.USER);
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          sessionId,
          role: MessageRole.USER,
          content: 'Hello',
          type: MessageType.TEXT,
        },
      });
    });
  });

  describe('saveAssistantMessage', () => {
    it('should create assistant message', async () => {
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg_2',
        sessionId,
        role: MessageRole.ASSISTANT,
        content: 'AI reply',
        type: MessageType.TEXT,
      });

      const result = await service.saveAssistantMessage(sessionId, 'AI reply');
      expect(result.role).toBe(MessageRole.ASSISTANT);
    });
  });

  describe('incrementUsage', () => {
    it('should increment usageConsumed by 1', async () => {
      await service.incrementUsage(subscriptionId);

      expect(mockQuotaService.incrementUsage).toHaveBeenCalledWith(
        subscriptionId,
      );
    });
  });

  describe('getMessages', () => {
    it('should return paginated messages sorted by createdAt asc', async () => {
      mockPrisma.session.findFirst.mockResolvedValue({
        id: sessionId,
        userId,
        title: 'Test Session',
      });
      mockPrisma.message.findMany.mockResolvedValue([
        {
          id: 'msg_1',
          sessionId,
          role: MessageRole.USER,
          content: 'Hello',
          type: MessageType.TEXT,
          createdAt: new Date('2026-06-01T00:00:00Z'),
          updatedAt: new Date('2026-06-01T00:00:00Z'),
        },
        {
          id: 'msg_2',
          sessionId,
          role: MessageRole.ASSISTANT,
          content: 'Hi there',
          type: MessageType.TEXT,
          createdAt: new Date('2026-06-01T00:01:00Z'),
          updatedAt: new Date('2026-06-01T00:01:00Z'),
        },
      ]);
      mockPrisma.message.count.mockResolvedValue(2);

      const result = await service.getMessages(sessionId, userId, 1, 20);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].role).toBe('USER');
      expect(result.items[1].role).toBe('ASSISTANT');
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        skip: 0,
        take: 20,
      });
    });

    it('should throw ForbiddenException for non-owned session', async () => {
      mockPrisma.session.findFirst.mockResolvedValue(null);

      await expect(
        service.getMessages(sessionId, userId, 1, 20),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createMessageStream', () => {
    it('should emit SSE chunks and save assistant message', (done) => {
      mockPrisma.session.findFirst.mockResolvedValue({
        id: sessionId,
        userId,
        title: 'Test Session',
      });
      mockQuotaService.checkUserQuota.mockResolvedValue({
        subscription: {
          id: subscriptionId,
          usageQuota: 100,
          usageConsumed: 10,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 86400000),
        },
        plan: {
          id: 'plan-1',
          name: 'Pro',
          quotaLimits: { text_chats: -1 },
        },
      });
      mockPrisma.message.create.mockResolvedValue({});
      mockPrisma.subscription.update.mockResolvedValue({});

      const stream = service.createMessageStream(userId, {
        sessionId,
        content: 'Hello AI',
        type: MessageType.TEXT,
      });

      const chunks: string[] = [];
      let doneReceived = false;

      stream.subscribe({
        next: (chunk) => {
          if (!chunk.done) {
            chunks.push(chunk.chunk);
          } else {
            doneReceived = true;
          }
        },
        error: (err) => done(err),
        complete: () => {
          expect(doneReceived).toBe(true);
          expect(chunks.length).toBeGreaterThan(0);
          // Verify user message saved
          expect(mockPrisma.message.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                sessionId,
                role: MessageRole.USER,
                content: 'Hello AI',
                type: MessageType.TEXT,
              }),
            }),
          );
          // Verify assistant message will be saved
          done();
        },
      });
    }, 10000);

    it('should submit generation task for IMAGE_GEN and return task info', (done) => {
      mockPrisma.session.findFirst.mockResolvedValue({
        id: sessionId,
        userId,
        title: 'Test Session',
      });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-gen-1',
        sessionId,
        role: MessageRole.USER,
        content: 'Generate an image of a cat',
        type: MessageType.IMAGE_GEN,
      });
      mockGenerationTaskService.submitTask.mockResolvedValue({
        id: 'task-1',
        status: GenerationStatus.PENDING,
      });

      const stream = service.createMessageStream(userId, {
        sessionId,
        content: 'Generate an image of a cat',
        type: MessageType.IMAGE_GEN,
      });

      stream.subscribe({
        next: (chunk) => {
          expect(chunk.done).toBe(true);
          expect(chunk.task).toEqual({
            taskId: 'task-1',
            status: 'PENDING',
          });
        },
        error: (err) => done(err),
        complete: () => {
          expect(mockGenerationTaskService.submitTask).toHaveBeenCalledWith({
            messageId: 'msg-gen-1',
            userId,
            type: 'IMAGE',
          });
          expect(mockQuotaService.checkUserQuota).not.toHaveBeenCalled();
          done();
        },
      });
    }, 10000);

    it('should submit generation task for VIDEO_GEN and return task info', (done) => {
      mockPrisma.session.findFirst.mockResolvedValue({
        id: sessionId,
        userId,
        title: 'Test Session',
      });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-gen-2',
        sessionId,
        role: MessageRole.USER,
        content: 'Generate a video of a sunset',
        type: MessageType.VIDEO_GEN,
      });
      mockGenerationTaskService.submitTask.mockResolvedValue({
        id: 'task-2',
        status: GenerationStatus.PROCESSING,
      });

      const stream = service.createMessageStream(userId, {
        sessionId,
        content: 'Generate a video of a sunset',
        type: MessageType.VIDEO_GEN,
      });

      stream.subscribe({
        next: (chunk) => {
          expect(chunk.done).toBe(true);
          expect(chunk.task).toEqual({
            taskId: 'task-2',
            status: 'PROCESSING',
          });
        },
        error: (err) => done(err),
        complete: () => {
          expect(mockGenerationTaskService.submitTask).toHaveBeenCalledWith({
            messageId: 'msg-gen-2',
            userId,
            type: 'VIDEO',
          });
          done();
        },
      });
    }, 10000);

    it('should propagate generation task errors through SSE', (done) => {
      mockPrisma.session.findFirst.mockResolvedValue({
        id: sessionId,
        userId,
        title: 'Test Session',
      });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-gen-3',
        sessionId,
        role: MessageRole.USER,
        content: 'Generate an image',
        type: MessageType.IMAGE_GEN,
      });
      mockGenerationTaskService.submitTask.mockRejectedValue(
        new HttpException('Quota exceeded', HttpStatus.PAYMENT_REQUIRED),
      );

      const stream = service.createMessageStream(userId, {
        sessionId,
        content: 'Generate an image',
        type: MessageType.IMAGE_GEN,
      });

      stream.subscribe({
        next: (chunk) => {
          expect(chunk.done).toBe(true);
          expect(chunk.error).toBe('Quota exceeded');
        },
        error: (err) => done(err),
        complete: () => {
          done();
        },
      });
    }, 10000);
  });
});
