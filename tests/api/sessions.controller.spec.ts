import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { Request, Response, NextFunction } from 'express';
import { SessionsController } from '../../src/sessions/sessions.controller';
import { SessionsService } from '../../src/sessions/sessions.service';
import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

describe('SessionsController (e2e)', () => {
  let app: INestApplication;
  let sessionsService: SessionsService;

  const mockSessionsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    restore: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        { provide: SessionsService, useValue: mockSessionsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    sessionsService = moduleRef.get<SessionsService>(SessionsService);

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    // Mock user on request
    app.use((req: Request, res: Response, next: NextFunction) => {
      (req as any).user = { id: 'user-1', email: 'test@example.com', phone: null };
      next();
    });

    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /sessions', () => {
    it('should create a new session', async () => {
      const session = {
        id: 'session-1',
        userId: 'user-1',
        title: 'New Session',
        status: 'ACTIVE',
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockSessionsService.create.mockResolvedValue(session);

      return request(app.getHttpServer())
        .post('/sessions')
        .send({})
        .expect(201)
        .expect((res) => {
          expect(res.body.code).toBe(200);
          expect(res.body.data.id).toBe('session-1');
        });
    });

    it('should create a session with custom title', async () => {
      const session = {
        id: 'session-1',
        userId: 'user-1',
        title: 'Custom Title',
        status: 'ACTIVE',
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockSessionsService.create.mockResolvedValue(session);

      return request(app.getHttpServer())
        .post('/sessions')
        .send({ title: 'Custom Title' })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.title).toBe('Custom Title');
        });
    });
  });

  describe('GET /sessions', () => {
    it('should return paginated session list', async () => {
      mockSessionsService.findAll.mockResolvedValue({
        items: [
          { id: 's1', title: 'Session 1' },
          { id: 's2', title: 'Session 2' },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      });

      return request(app.getHttpServer())
        .get('/sessions')
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(200);
          expect(res.body.data.items).toHaveLength(2);
          expect(res.body.data.total).toBe(2);
        });
    });

    it('should pass pagination params', async () => {
      mockSessionsService.findAll.mockResolvedValue({
        items: [],
        total: 50,
        page: 2,
        pageSize: 10,
      });

      return request(app.getHttpServer())
        .get('/sessions?page=2&pageSize=10')
        .expect(200)
        .expect((res) => {
          expect(mockSessionsService.findAll).toHaveBeenCalledWith(
            'user-1',
            2,
            10,
          );
        });
    });
  });

  describe('GET /sessions/:id', () => {
    it('should return session detail with messages', async () => {
      const session = {
        id: 'session-1',
        userId: 'user-1',
        title: 'Test',
        messages: [{ id: 'm1', role: 'USER', content: 'Hello' }],
      };
      mockSessionsService.findOne.mockResolvedValue(session);

      return request(app.getHttpServer())
        .get('/sessions/session-1')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toBe('session-1');
          expect(res.body.data.messages).toHaveLength(1);
        });
    });

    it('should return 404 for non-existent session', async () => {
      const { NotFoundException } = require('@nestjs/common');
      mockSessionsService.findOne.mockRejectedValue(
        new NotFoundException('Session not found'),
      );

      return request(app.getHttpServer())
        .get('/sessions/nonexistent')
        .expect(404);
    });
  });

  describe('PATCH /sessions/:id', () => {
    it('should rename session', async () => {
      const session = {
        id: 'session-1',
        title: 'New Title',
      };
      mockSessionsService.update.mockResolvedValue(session);

      return request(app.getHttpServer())
        .patch('/sessions/session-1')
        .send({ title: 'New Title' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.title).toBe('New Title');
        });
    });

    it('should return 400 for invalid title', async () => {
      return request(app.getHttpServer())
        .patch('/sessions/session-1')
        .send({ title: '' })
        .expect(400);
    });
  });

  describe('DELETE /sessions/:id', () => {
    it('should soft delete session', async () => {
      mockSessionsService.remove.mockResolvedValue({
        id: 'session-1',
        deletedAt: new Date(),
      });

      return request(app.getHttpServer())
        .delete('/sessions/session-1')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.deletedAt).toBeDefined();
        });
    });
  });

  describe('POST /sessions/:id/restore', () => {
    it('should restore deleted session', async () => {
      mockSessionsService.restore.mockResolvedValue({
        id: 'session-1',
        deletedAt: null,
      });

      return request(app.getHttpServer())
        .post('/sessions/session-1/restore')
        .expect(201)
        .expect((res) => {
          expect(res.body.data.deletedAt).toBeNull();
        });
    });
  });
});
