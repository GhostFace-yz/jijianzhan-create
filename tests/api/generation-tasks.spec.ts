import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  HttpStatus,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import { GenerationTasksModule } from '../../src/generation-tasks/generation-tasks.module';
import { GenerationTaskService } from '../../src/generation-tasks/generation-task.service';
import { QuotaService } from '../../src/common/quota.service';
import { AgnesProvider } from '../../src/generation-tasks/agnes.provider';
import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard';
import { GenerationStatus, GenerationType } from '@prisma/client';

const mockUser = { id: 'user-123', email: 'test@example.com', phone: null };

const mockTask = {
  id: 'task-123',
  messageId: 'msg-456',
  userId: mockUser.id,
  type: GenerationType.IMAGE,
  providerTaskId: 'agnes-task-789',
  status: GenerationStatus.PROCESSING,
  resultUrl: null,
  params: { prompt: 'A cat in space' },
  errorMessage: null,
  progress: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockQuotaResult = {
  subscription: {
    id: 'sub-123',
    usageQuota: 100,
    usageConsumed: 5,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
  plan: {
    id: 'plan-123',
    name: 'Pro',
    quotaLimits: { image_gens: 50, video_gens: 20 },
  },
};

describe('GenerationTasksController (integration)', () => {
  let app: INestApplication;
  let generationTaskService: GenerationTaskService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        GenerationTasksModule,
      ],
    })
      .overrideProvider(QuotaService)
      .useValue({
        checkGenerationQuota: jest.fn().mockResolvedValue(mockQuotaResult),
        incrementUsage: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(AgnesProvider)
      .useValue({
        submitTask: jest
          .fn()
          .mockResolvedValue({ providerTaskId: 'agnes-task-789' }),
      })
      .overrideProvider(GenerationTaskService)
      .useValue({
        submitTask: jest.fn().mockResolvedValue(mockTask),
        getTask: jest.fn().mockResolvedValue(mockTask),
        retryTask: jest.fn().mockResolvedValue({
          ...mockTask,
          status: GenerationStatus.PENDING,
          providerTaskId: null,
        }),
        resubmitToAgnes: jest.fn().mockResolvedValue(mockTask),
        handleWebhookCallback: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key: string) => {
          if (key === 'WEBHOOK_SECRET') return 'test-secret';
          return undefined;
        }),
        getOrThrow: jest.fn((key: string) => {
          if (key === 'AGNES_API_KEY') return 'test-api-key';
          throw new Error(`Missing config: ${key}`);
        }),
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = mockUser;
          return true;
        },
      })
      .compile();

    generationTaskService = moduleFixture.get(GenerationTaskService);

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /generation-tasks', () => {
    it('should submit a generation task and return task details', () => {
      return request(app.getHttpServer())
        .post('/generation-tasks')
        .send({
          messageId: 'msg-456',
          type: 'IMAGE',
          params: { prompt: 'A cat in space' },
        })
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.id).toBe(mockTask.id);
          expect(res.body.status).toBe(GenerationStatus.PROCESSING);
          expect(res.body.type).toBe(GenerationType.IMAGE);
        });
    });

    it('should reject invalid generation type', () => {
      return request(app.getHttpServer())
        .post('/generation-tasks')
        .send({
          messageId: 'msg-456',
          type: 'INVALID_TYPE',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject missing messageId', () => {
      return request(app.getHttpServer())
        .post('/generation-tasks')
        .send({
          type: 'IMAGE',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('GET /generation-tasks/:id', () => {
    it('should return task status for owned task', () => {
      return request(app.getHttpServer())
        .get('/generation-tasks/task-123')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe('task-123');
          expect(res.body.status).toBe(GenerationStatus.PROCESSING);
        });
    });

    it('should return 404 for non-existent task', async () => {
      jest
        .spyOn(generationTaskService, 'getTask')
        .mockRejectedValueOnce(new NotFoundException('Generation task not found'));

      return request(app.getHttpServer())
        .get('/generation-tasks/nonexistent')
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('POST /generation-tasks/:id/retry', () => {
    it('should retry a failed task', () => {
      return request(app.getHttpServer())
        .post('/generation-tasks/task-123/retry')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe('task-123');
        });
    });
  });

  describe('POST /internal/webhooks/generation-callback', () => {
    it('should update task status on valid webhook callback', () => {
      return request(app.getHttpServer())
        .post('/internal/webhooks/generation-callback')
        .set('X-Webhook-Secret', 'test-secret')
        .send({
          provider_task_id: 'agnes-task-789',
          status: 'COMPLETED',
          result_url: 'https://cdn.example.com/result.png',
        })
        .expect(HttpStatus.NO_CONTENT);
    });

    it('should reject callback with invalid webhook secret', () => {
      return request(app.getHttpServer())
        .post('/internal/webhooks/generation-callback')
        .set('X-Webhook-Secret', 'wrong-secret')
        .send({
          provider_task_id: 'agnes-task-789',
          status: 'COMPLETED',
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should reject callback without webhook secret', () => {
      return request(app.getHttpServer())
        .post('/internal/webhooks/generation-callback')
        .send({
          provider_task_id: 'agnes-task-789',
          status: 'COMPLETED',
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should reject invalid callback payload', () => {
      return request(app.getHttpServer())
        .post('/internal/webhooks/generation-callback')
        .set('X-Webhook-Secret', 'test-secret')
        .send({
          provider_task_id: 'agnes-task-789',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });
});
