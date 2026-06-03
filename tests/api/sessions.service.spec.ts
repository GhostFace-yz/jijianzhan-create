import { Test, TestingModule } from '@nestjs/testing';
import { SessionsService } from '../../src/sessions/sessions.service';
import { PrismaService } from '../../src/common/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { SessionStatus } from '@prisma/client';

describe('SessionsService', () => {
  let service: SessionsService;
  let prisma: PrismaService;

  const mockPrisma = {
    session: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a session with default title', async () => {
      const userId = 'user-1';
      mockPrisma.session.create.mockResolvedValue({
        id: 'session-1',
        userId,
        title: '新对话',
        status: SessionStatus.ACTIVE,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(userId);

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: { userId, title: '新对话' },
      });
      expect(result.title).toBe('新对话');
    });

    it('should create a session with custom title', async () => {
      const userId = 'user-1';
      mockPrisma.session.create.mockResolvedValue({
        id: 'session-1',
        userId,
        title: 'Custom Title',
        status: SessionStatus.ACTIVE,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(userId, 'Custom Title');

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: { userId, title: 'Custom Title' },
      });
      expect(result.title).toBe('Custom Title');
    });
  });

  describe('findAll', () => {
    it('should return paginated sessions excluding deleted ones', async () => {
      const userId = 'user-1';
      const sessions = [
        { id: 's1', userId, title: 'Session 1', deletedAt: null },
        { id: 's2', userId, title: 'Session 2', deletedAt: null },
      ];

      mockPrisma.session.findMany.mockResolvedValue(sessions);
      mockPrisma.session.count.mockResolvedValue(2);

      const result = await service.findAll(userId, 1, 20);

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should respect pagination parameters', async () => {
      const userId = 'user-1';
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(50);

      const result = await service.findAll(userId, 2, 10);

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });
  });

  describe('findOne', () => {
    it('should return session with recent messages for owner', async () => {
      const userId = 'user-1';
      const session = {
        id: 'session-1',
        userId,
        title: 'Test Session',
        messages: [
          { id: 'm1', role: 'USER', content: 'Hello', createdAt: new Date() },
          { id: 'm2', role: 'ASSISTANT', content: 'Hi', createdAt: new Date() },
        ],
      };

      mockPrisma.session.findUnique.mockResolvedValue(session);

      const result = await service.findOne('session-1', userId);

      expect(mockPrisma.session.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              role: true,
              content: true,
              createdAt: true,
            },
          },
        },
      });
      expect(result.id).toBe('session-1');
    });

    it('should throw NotFoundException if session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'other-user',
        title: 'Test',
      });

      await expect(service.findOne('session-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reverse messages to chronological order', async () => {
      const userId = 'user-1';
      const session = {
        id: 'session-1',
        userId,
        title: 'Test',
        messages: [
          { id: 'm2', role: 'ASSISTANT', content: 'Hi', createdAt: new Date('2026-01-02') },
          { id: 'm1', role: 'USER', content: 'Hello', createdAt: new Date('2026-01-01') },
        ],
      };

      mockPrisma.session.findUnique.mockResolvedValue(session);

      const result = await service.findOne('session-1', userId);

      expect(result.messages[0].id).toBe('m1');
      expect(result.messages[1].id).toBe('m2');
    });
  });

  describe('update', () => {
    it('should update session title for owner', async () => {
      const userId = 'user-1';
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId,
        title: 'Old Title',
      });
      mockPrisma.session.update.mockResolvedValue({
        id: 'session-1',
        userId,
        title: 'New Title',
      });

      const result = await service.update('session-1', userId, { title: 'New Title' });

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { title: 'New Title' },
      });
      expect(result.title).toBe('New Title');
    });

    it('should throw NotFoundException if session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', 'user-1', { title: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'other-user',
        title: 'Old Title',
      });

      await expect(
        service.update('session-1', 'user-1', { title: 'New' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should soft delete session for owner', async () => {
      const userId = 'user-1';
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId,
        title: 'Test',
        deletedAt: null,
      });
      mockPrisma.session.update.mockResolvedValue({
        id: 'session-1',
        userId,
        deletedAt: new Date(),
      });

      const result = await service.remove('session-1', userId);

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result.deletedAt).toBeDefined();
    });

    it('should throw NotFoundException if session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'other-user',
        deletedAt: null,
      });

      await expect(service.remove('session-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException if already deleted', async () => {
      const userId = 'user-1';
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId,
        deletedAt: new Date(),
      });

      await expect(service.remove('session-1', userId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('restore', () => {
    it('should restore a deleted session for owner', async () => {
      const userId = 'user-1';
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId,
        title: 'Test',
        deletedAt: new Date(),
      });
      mockPrisma.session.update.mockResolvedValue({
        id: 'session-1',
        userId,
        deletedAt: null,
      });

      const result = await service.restore('session-1', userId);

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { deletedAt: null },
      });
      expect(result.deletedAt).toBeNull();
    });

    it('should throw NotFoundException if session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(service.restore('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'other-user',
        deletedAt: new Date(),
      });

      await expect(service.restore('session-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException if session is not deleted', async () => {
      const userId = 'user-1';
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId,
        deletedAt: null,
      });

      await expect(service.restore('session-1', userId)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
