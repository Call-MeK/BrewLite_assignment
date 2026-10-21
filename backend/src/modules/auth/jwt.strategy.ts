import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  ver: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (
      typeof payload?.sub !== 'string' ||
      typeof payload?.email !== 'string' ||
      !Number.isInteger(payload?.ver)
    ) {
      throw new UnauthorizedException('Token không hợp lệ');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { email: true, tokenVersion: true },
    });
    if (!user || user.tokenVersion !== payload.ver || user.email !== payload.email) {
      throw new UnauthorizedException('Token đã hết hiệu lực');
    }
    return { sub: payload.sub, email: payload.email, ver: payload.ver };
  }
}
