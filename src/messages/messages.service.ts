import {
  Injectable,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, Subscriber } from 'rxjs';
import { PrismaService } from '../common/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageRole, MessageType, SubscriptionStatus } from '@prisma/client';

export interface SseChunk {
  chunk: string;
  done: boolean;
}

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async verifySessionOwnership(sessionId: string, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
        deletedAt: null,
      },
    });

    if (!session) {
      throw new ForbiddenException('Session does not belong to current user');
    }

    return session;
  }

  async checkUserQuota(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { gte: new Date() },
      },
    });

    if (!subscription) {
      throw new HttpException(
        'No active subscription found',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    if (subscription.usageConsumed >= subscription.usageQuota) {
      throw new HttpException(
        'Usage quota exceeded',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return subscription;
  }

  async saveUserMessage(dto: SendMessageDto) {
    return this.prisma.message.create({
      data: {
        sessionId: dto.sessionId,
        role: MessageRole.USER,
        content: dto.content,
        type: dto.type ?? MessageType.TEXT,
      },
    });
  }

  async saveAssistantMessage(sessionId: string, content: string) {
    return this.prisma.message.create({
      data: {
        sessionId,
        role: MessageRole.ASSISTANT,
        content,
        type: MessageType.TEXT,
      },
    });
  }

  async incrementUsage(subscriptionId: string) {
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        usageConsumed: { increment: 1 },
      },
    });
  }

  async getMessages(sessionId: string, userId: string, page = 1, pageSize = 20) {
    await this.verifySessionOwnership(sessionId, userId);

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.message.count({ where: { sessionId } }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  createMessageStream(
    userId: string,
    dto: SendMessageDto,
  ): Observable<SseChunk> {
    return new Observable((subscriber: Subscriber<SseChunk>) => {
      let cancelled = false;
      let fullContent = '';

      const run = async () => {
        try {
          // 1. Verify ownership
          await this.verifySessionOwnership(dto.sessionId, userId);

          // 2. Check quota
          const subscription = await this.checkUserQuota(userId);

          // 3. Save user message
          await this.saveUserMessage(dto);

          // 4. Increment usage
          await this.incrementUsage(subscription.id);

          // 5. Mock AI stream
          const chunks = this.mockAiStream(dto.content);

          for (const chunk of chunks) {
            if (cancelled) break;
            fullContent += chunk;
            subscriber.next({ chunk, done: false });
            // Simulate network latency
            await this.delay(50);
          }

          if (!cancelled) {
            subscriber.next({ chunk: '', done: true });
            subscriber.complete();
          }

          // 6. Save assistant message after stream
          await this.saveAssistantMessage(dto.sessionId, fullContent);
        } catch (err) {
          if (!cancelled) {
            subscriber.error(err);
          }
        }
      };

      run();

      return () => {
        cancelled = true;
      };
    });
  }

  private mockAiStream(_userContent: string): string[] {
    const reply =
      '这是一个模拟的 AI 回复。在实际实现中，这里将调用真实的 AI Provider 生成流式内容。';
    // Split into character chunks for streaming effect
    return reply.split('');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
