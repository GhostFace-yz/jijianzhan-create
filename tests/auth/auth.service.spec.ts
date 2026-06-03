import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../src/auth/auth.service';
import { PrismaService } from '../../src/common/prisma.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  mockPrisma.$transaction = jest.fn(async (callback: any) => callback(mockPrisma));

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('signed-token'),
    verify: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return 'access-secret';
      if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
      return '';
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  describe('registerEmail', () => {
    it('should create a new user with hashed password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        phone: null,
        name: 'test',
        createdAt: new Date(),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.registerEmail('test@example.com', 'Password123');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: { id: true },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123', 12);
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(result.email).toBe('test@example.com');
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.registerEmail('test@example.com', 'Password123'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('validateUser', () => {
    it('should return user if credentials are valid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        phone: null,
        passwordHash: 'hashed-password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'Password123');

      expect(result.id).toBe('user-1');
      expect(bcrypt.compare).toHaveBeenCalledWith('Password123', 'hashed-password');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser('test@example.com', 'Password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        phone: null,
        passwordHash: 'hashed-password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateUser('test@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      mockPrisma.refreshToken.findMany.mockResolvedValue([]);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.generateTokens(
        'user-1',
        'test@example.com',
        null,
        'device-1',
        '127.0.0.1',
      );

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.expiresIn).toBe(7200);
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
    });

    it('should enforce max 3 devices by removing oldest token', async () => {
      const existingTokens = [
        { id: 'token-1', createdAt: new Date('2026-01-01') },
        { id: 'token-2', createdAt: new Date('2026-01-02') },
        { id: 'token-3', createdAt: new Date('2026-01-03') },
      ];
      mockPrisma.refreshToken.findMany.mockResolvedValue(existingTokens);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      await service.generateTokens('user-1', 'test@example.com', null);

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['token-1'] } },
      });
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('refreshTokens', () => {
    it('should return new token pair on valid refresh token', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1',
        jti: 'refresh-jti-1',
        type: 'refresh',
      });
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
        deviceFingerprint: 'device-1',
        ipAddress: '127.0.0.1',
      });
      mockPrisma.refreshToken.delete.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        phone: null,
      });
      mockPrisma.refreshToken.findMany.mockResolvedValue([]);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result.accessToken).toBe('signed-token');
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { tokenJti: 'refresh-jti-1' },
      });
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token type is not refresh', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1',
        jti: 'access-jti',
        type: 'access',
      });

      await expect(service.refreshTokens('access-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if refresh token is revoked', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1',
        jti: 'revoked-jti',
        type: 'refresh',
      });
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens('revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should delete refresh token on logout', async () => {
      mockJwtService.verify.mockReturnValue({ jti: 'refresh-jti-1' });
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout('valid-refresh-token');

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { tokenJti: 'refresh-jti-1' },
      });
    });

    it('should not throw on invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(service.logout('invalid-token')).resolves.not.toThrow();
    });
  });

  describe('logoutAllDevices', () => {
    it('should delete all refresh tokens for user', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      await service.logoutAllDevices('user-1');

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });
});
