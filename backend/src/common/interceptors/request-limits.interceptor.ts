import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isIP } from 'node:net';
import { Request, Response } from 'express';

type Bucket = { count: number; resetAt: number };

@Injectable()
export class RequestLimitsInterceptor implements NestInterceptor, OnModuleDestroy {
  private readonly reads = new Map<string, Bucket>();
  private readonly writes = new Map<string, Bucket>();
  private readonly cleanup: ReturnType<typeof setInterval>;

  constructor(private readonly config: ConfigService) {
    this.cleanup = setInterval(() => {
      const now = Date.now();
      for (const buckets of [this.reads, this.writes]) {
        for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
      }
    }, 15000);
    this.cleanup.unref();
  }

  onModuleDestroy() { clearInterval(this.cleanup); }

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request & { user?: { sub: string } }>();
    const response = context.switchToHttp().getResponse<Response>();
    const controller = context.getClass().name;
    const action = context.getHandler().name;
    if ((controller === 'ZaloPaySandboxController' && action === 'callback')
      || action === 'healthCheck'
      || (this.config.get('NODE_ENV') === 'test' && this.config.get('REQUEST_LIMITS_ENABLED') === 'false')) {
      return next.handle();
    }
    const identity = request.user?.sub ? `user:${request.user.sub}` : `ip:${this.clientIp(request)}`;
    const read = request.method === 'GET' || request.method === 'HEAD';
    const buckets = read ? this.reads : this.writes;
    const key = read ? identity : `${identity}:${controller}:${action}:${request.method}`;
    const duration = read ? 60000 : 5000;
    const limit = read ? 60 : 1;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (bucket && bucket.resetAt <= now) { buckets.delete(key); bucket = undefined; }
    if (!bucket) {
      if (buckets.size >= 10000) this.reject(response, 5);
      bucket = { count: 0, resetAt: now + duration };
      buckets.set(key, bucket);
    }
    if (bucket.count >= limit) this.reject(response, Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
    bucket.count++;
    return next.handle();
  }

  private reject(response: Response, retryAfter: number): never {
    response.setHeader('Retry-After', String(retryAfter));
    throw new HttpException({ message: `Vui lòng chờ ${retryAfter} giây trước khi gửi lại yêu cầu.`, retryAfter }, 429);
  }

  private clientIp(request: Request) {
    const remote = request.socket?.remoteAddress || request.ip || 'unknown';
    // Cloudflared connects over loopback; never trust this header on direct remote connections.
    const forwarded = request.headers['cf-connecting-ip'];
    if (['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) && typeof forwarded === 'string' && isIP(forwarded)) return forwarded;
    return remote;
  }
}
