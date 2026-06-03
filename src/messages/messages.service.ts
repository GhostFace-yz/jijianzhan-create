import {
  Injectable,
  ForbiddenException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Observable, Subscriber } from 'rxjs';
import { PrismaService } from '../common/prisma.service';
import { QuotaService } from '../common/quota.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageRole, MessageType } from '@prisma/client';
import { KimiProvider, ChatMessage, KimiApiError } from './kimi.provider';

export interface SseChunk {
  chunk: string;
  done: boolean;
  error?: string;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotaService: QuotaService,
    private readonly kimiProvider: KimiProvider,
  ) {}

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
    const result = await this.quotaService.checkUserQuota(userId);
    return this.prisma.subscription.findUniqueOrThrow({
      where: { id: result.subscription.id },
    });
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
    await this.quotaService.incrementUsage(subscriptionId);
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
      const abortController = new AbortController();

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

          // 5. Build context messages (history + current)
          const contextMessages = await this.buildContextMessages(dto);

          // 6. Stream real AI response
          for await (const chunk of this.kimiProvider.streamChat(
            contextMessages,
            abortController.signal,
          )) {
            if (cancelled) break;
            fullContent += chunk;
            subscriber.next({ chunk, done: false });
          }

          if (!cancelled) {
            subscriber.next({ chunk: '', done: true });
            subscriber.complete();
          }

          // 7. Save assistant message after stream
          if (fullContent) {
            await this.saveAssistantMessage(dto.sessionId, fullContent);
          }
        } catch (err: any) {
          if (cancelled) return;

          this.logger.error(
            `Message stream error: ${err.message}`,
            err.stack,
          );

          // Send error through SSE so frontend can handle gracefully
          const errorMessage =
            err instanceof HttpException
              ? err.message
              : err instanceof KimiApiError
                ? err.message
                : '服务暂时不可用，请稍后再试';

          subscriber.next({ chunk: '', done: true, error: errorMessage });
          subscriber.complete();
        }
      };

      run();

      return () => {
        cancelled = true;
        abortController.abort();
      };
    });
  }

  private readonly MAX_CONTEXT_MESSAGES = 40;
  private readonly MAX_CONTEXT_TOKENS = 4000;

  private async buildContextMessages(
    dto: SendMessageDto,
  ): Promise<ChatMessage[]> {
    // Fetch recent history (up to 20 rounds = 40 messages) excluding the current one
    const history = await this.prisma.message.findMany({
      where: {
        sessionId: dto.sessionId,
        role: { in: [MessageRole.USER, MessageRole.ASSISTANT] },
        type: MessageType.TEXT,
      },
      orderBy: { createdAt: 'desc' },
      take: this.MAX_CONTEXT_MESSAGES,
    });

    // Reverse to chronological order
    history.reverse();

    let messages: ChatMessage[] = history.map((msg) => ({
      role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
      content: msg.content,
    }));

    // Append current user message
    messages.push({
      role: 'user',
      content: dto.content,
    });

    // Truncate by estimated token count, dropping oldest messages first
    messages = this.truncateByTokens(messages, this.MAX_CONTEXT_TOKENS);

    return messages;
  }

  private truncateByTokens(
    messages: ChatMessage[],
    maxTokens: number,
  ): ChatMessage[] {
    let total = messages.reduce((sum, m) => sum + this.estimateTokens(m.content), 0);

    while (total > maxTokens && messages.length > 1) {
      const removed = messages.shift();
      if (removed) {
        total -= this.estimateTokens(removed.content);
      }
    }

    return messages;
  }

  private estimateTokens(text: string): number {
    // Rough heuristic for mixed Chinese / Latin content:
    // Chinese characters ≈ 1 token each; other chars ≈ 0.25 token each.
    let tokens = 0;
    for (const char of text) {
      const code = char.charCodeAt(0);
      // CJK Unified Ideographs + Extension A + CJK symbols / punctuation / fullwidth
      const isCjk =
        (code >= 0x4e00 && code <= 0x9fff) ||
        (code >= 0x3400 && code <= 0x4dbf) ||
        (code >= 0x3000 && code <= 0x303f) ||
        (code >= 0xff00 && code <= 0xffef);
      tokens += isCjk ? 1 : 0.25;
    }
    return Math.ceil(tokens);
  }
}
