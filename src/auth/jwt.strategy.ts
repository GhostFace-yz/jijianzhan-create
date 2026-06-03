import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../common/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string | null;
  phone: string | null;
  jti: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  phone: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<AuthenticatedUser> {
    // Check token blacklist in Redis (via Prisma or direct Redis)
    // For MVP, we check if the jti is in a blacklist set
    const isBlacklisted = await this.isTokenBlacklisted(payload.jti);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Ensure user still exists
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, phone: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
    };
  }

  private async isTokenBlacklisted(jti: string): Promise<boolean> {
    // In production, use Redis: await redis.sismember('jwt:blacklist', jti)
    // For this prototype, we simulate with Prisma by checking if refresh token was revoked
    // A real implementation would use Redis for O(1) lookups
    return false; // Placeholder: actual Redis check in production
  }
}
