import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { MessagesModule } from '../../src/messages/messages.module';
import { PrismaModule } from '../../src/common/prisma.module';
import { PrismaService } from '../../src/common/prisma.service';
import { AuthModule } from '../../src/auth/auth.module';
import { MessageRole, MessageType, SubscriptionStatus } from '@prisma/client';

describe('MessagesController (integration)', () => {
  let app: INestApplication;
  let prismaMock: any;
  let jwtService: JwtService;

  const userId = 'user_test_123';
  const sessionId = 'session_test_456';
  const otherSessionId = 'session_other_789';
  const subscriptionId = 'sub_test_123';

  beforeAll(async () => {
    prismaMock = {
      session: {
        findFirst: jest.fn(),
      },
      subscription: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      message: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              JWT_ACCESS_SECRET: 'test-secret',
            }),
          ],
        }),
        PrismaModule,
        AuthModule,
        MessagesModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'test@example.com',
      phone: null,
    });
  });

  function getAuthToken(uid: string = userId): string {
    return jwtService.sign(
      { sub: uid, email: 'test@example.com', phone: null, jti: 'jti_test' },
      { secret: 'test-secret' },
    );
  }

  describe('POST /messages', () => {
    it('should return SSE stream with AI response chunks and save assistant message', async () => {
      prismaMock.session.findFirst.mockResolvedValue({
        id: sessionId,
        userId,
        title: 'Test Session',
      });
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: subscriptionId,
        userId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 86400000),
        usageQuota: 100,
        usageConsumed: 10,
      });
      prismaMock.message.create.mockResolvedValue({
        id: 'msg_user_1',
        sessionId,
        role: MessageRole.USER,
        content: 'Hello AI',
        type: MessageType.TEXT,
      });
      prismaMock.subscription.update.mockResolvedValue({});

      const response = await request(app.getHttpServer())
        .post('/messages')
        .set('Authorization', `Bearer ${getAuthToken()}`)
        .send({ sessionId, content: 'Hello AI', type: 'TEXT' })
        .buffer(true)
        .parse((res, callback) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on('end', () => {
            callback(null, data);
          });
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');

      const body = (response.body ?? response.text) as string;
      const lines = body.split('\n').filter((l) => l.trim());
      const doneLine = lines.find((l) => l.includes('"done":true'));
      expect(doneLine).toBeDefined();

      // Verify user message saved
      expect(prismaMock.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionId,
            role: MessageRole.USER,
            content: 'Hello AI',
            type: MessageType.TEXT,
          }),
        }),
      );

      // Verify assistant message saved after stream
      expect(prismaMock.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionId,
            role: MessageRole.ASSISTANT,
            type: MessageType.TEXT,
          }),
        }),
      );
    }, 10000);

    it('should return 403 when session does not belong to user', async () => {
      prismaMock.session.findFirst.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/messages')
        .set('Authorization', `Bearer ${getAuthToken()}`)
        .send({ sessionId: otherSessionId, content: 'Hello', type: 'TEXT' });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Session does not belong');
    });

    it('should return 402 when usage quota exceeded', async () => {
      prismaMock.session.findFirst.mockResolvedValue({
        id: sessionId,
        userId,
        title: 'Test Session',
      });
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: subscriptionId,
        userId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 86400000),
        usageQuota: 100,
        usageConsumed: 100,
      });

      const response = await request(app.getHttpServer())
        .post('/messages')
        .set('Authorization', `Bearer ${getAuthToken()}`)
        .send({ sessionId, content: 'Hello', type: 'TEXT' });

      expect(response.status).toBe(402);
      expect(response.body.message).toContain('quota exceeded');
    });

    it('should return 402 when no active subscription', async () => {
      prismaMock.session.findFirst.mockResolvedValue({
        id: sessionId,
        userId,
        title: 'Test Session',
      });
      prismaMock.subscription.findFirst.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/messages')
        .set('Authorization', `Bearer ${getAuthToken()}`)
        .send({ sessionId, content: 'Hello', type: 'TEXT' });

      expect(response.status).toBe(402);
      expect(response.body.message).toContain('No active subscription');
    });
  });

  describe('GET /messages', () => {
    it('should return paginated message history sorted by createdAt asc', async () => {
      prismaMock.session.findFirst.mockResolvedValue({
        id: sessionId,
        userId,
        title: 'Test Session',
      });
      prismaMock.message.findMany.mockResolvedValue([
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
      prismaMock.message.count.mockResolvedValue(2);

      const response = await request(app.getHttpServer())
        .get('/messages')
        .query({ sessionId, page: 1, pageSize: 20 })
        .set('Authorization', `Bearer ${getAuthToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(2);
      expect(response.body.items[0].role).toBe('USER');
      expect(response.body.items[1].role).toBe('ASSISTANT');
      expect(response.body.total).toBe(2);
      expect(response.body.page).toBe(1);
    });

    it('should return 403 for non-owned session', async () => {
      prismaMock.session.findFirst.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/messages')
        .query({ sessionId: otherSessionId })
        .set('Authorization', `Bearer ${getAuthToken()}`);

      expect(response.status).toBe(403);
    });
  });
});
