import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly accessTokenExpiry = 7200; // 2 hours
  private readonly refreshTokenExpiry = 604800; // 7 days
  private readonly maxDevices = 3;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async registerEmail(email: string, password: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: email.split('@')[0],
      },
      select: { id: true, email: true, phone: true, name: true, createdAt: true },
    });

    return user;
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, phone: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { id: user.id, email: user.email, phone: user.phone };
  }

  async generateTokens(
    userId: string,
    email: string | null,
    phone: string | null,
    deviceFingerprint?: string,
    ipAddress?: string,
  ): Promise<TokenPair> {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const accessPayload = {
      sub: userId,
      email,
      phone,
      jti: accessJti,
    };

    const refreshPayload = {
      sub: userId,
      jti: refreshJti,
      type: 'refresh',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.accessTokenExpiry,
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.refreshTokenExpiry,
    });

    // Store refresh token in DB (enforce max 3 devices)
    await this.prisma.$transaction(async (tx) => {
      const existingTokens = await tx.refreshToken.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      if (existingTokens.length >= this.maxDevices) {
        const toDelete = existingTokens.slice(0, existingTokens.length - this.maxDevices + 1);
        await tx.refreshToken.deleteMany({
          where: { id: { in: toDelete.map((t) => t.id) } },
        });
      }

      await tx.refreshToken.create({
        data: {
          userId,
          tokenJti: refreshJti,
          deviceFingerprint,
          ipAddress,
          expiresAt: new Date(Date.now() + this.refreshTokenExpiry * 1000),
        },
      });
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiry,
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string; jti: string; type: string };

    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenJti: payload.jti },
      select: {
        userId: true,
        expiresAt: true,
        deviceFingerprint: true,
        ipAddress: true,
      },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has been revoked or expired');
    }

    // Delete old refresh token (rotation)
    await this.prisma.refreshToken.delete({ where: { tokenJti: payload.jti } });

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      select: { id: true, email: true, phone: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.generateTokens(
      user.id,
      user.email,
      user.phone,
      stored.deviceFingerprint ?? undefined,
      stored.ipAddress ?? undefined,
    );
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      if (payload.jti) {
        await this.prisma.refreshToken.deleteMany({
          where: { tokenJti: payload.jti },
        });
      }
    } catch {
      // Token invalid or expired — already effectively logged out
    }
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }
}
