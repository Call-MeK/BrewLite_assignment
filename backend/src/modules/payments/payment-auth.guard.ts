import {
  CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export type PaymentRequest = Request & { user: { sub: string } };

@Injectable()
export class PaymentAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PaymentRequest>();
    const authorization = request.headers.authorization;
    const match = typeof authorization === 'string' && /^Bearer (\S+)$/i.exec(authorization);
    if (!match) throw new UnauthorizedException('Vui lòng đăng nhập để tiếp tục');
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) throw new ServiceUnavailableException('Chưa cấu hình xác thực');
    try {
      const payload = await this.jwt.verifyAsync(match[1], { secret, algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || !payload.sub.trim() || !Number.isFinite(payload.exp)) {
        throw new Error('Invalid identity');
      }
      request.user = { sub: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('Vui lòng đăng nhập để tiếp tục');
    }
  }
}
