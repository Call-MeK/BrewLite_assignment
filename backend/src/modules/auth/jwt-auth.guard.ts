import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export type AuthenticatedRequest = Request & { user: { sub: string } };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization || '');
    const secret = this.config.get<string>('JWT_SECRET');
    if (!match || !secret) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync(match[1], { secret, algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || !payload.sub.trim() || !Number.isFinite(payload.exp)) {
        throw new UnauthorizedException();
      }
      request.user = { sub: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
