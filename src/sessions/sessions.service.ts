import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Session, Prisma } from '@prisma/client';

export interface CreateSessionInput {
  userId: string;
  title?: string;
}

export interface UpdateSessionInput {
  title: string;
}

@Injectable()
export class SessionsService {
  private readonly recentMessageLimit = 5;

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, title?: string): Promise<Session> {
    return this.prisma.session.create({
      data: {
        userId,
        title: title?.trim() || '新对话',
      },
    });
  }

  async findAll(userId: string, page = 1, pageSize = 20) {
    const where: Prisma.SessionWhereInput = {
      userId,
      deletedAt: null,
    };

    const [items, total] = await Promise.all([
      this.prisma.session.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.session.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string, userId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: this.recentMessageLimit,
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have access to this session');
    }

    // Reverse messages back to chronological order
    return {
      ...session,
      messages: session.messages.reverse(),
    };
  }

  async update(id: string, userId: string, input: UpdateSessionInput) {
    const session = await this.prisma.session.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have access to this session');
    }

    return this.prisma.session.update({
      where: { id },
      data: {
        title: input.title.trim(),
      },
    });
  }

  async remove(id: string, userId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have access to this session');
    }

    if (session.deletedAt) {
      throw new ConflictException('Session is already deleted');
    }

    return this.prisma.session.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string, userId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have access to this session');
    }

    if (!session.deletedAt) {
      throw new ConflictException('Session is not deleted');
    }

    return this.prisma.session.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}
