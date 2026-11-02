import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  readonly adminIds: Set<string>;
  protected message = 'Bạn không có quyền quản lý khách hàng';

  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    this.adminIds = new Set((config.get<string>('PAYMENT_ADMIN_USER_IDS') || '').split(',').map(id => id.trim()).filter(Boolean));
  }

  roleFor(user: { id: string; role?: UserRole | null }): UserRole {
    return user.role ?? (this.adminIds.has(user.id) ? UserRole.ADMIN : UserRole.CUSTOMER);
  }

  async isAdmin(userId: string, db: Pick<Prisma.TransactionClient, 'user'> = this.prisma): Promise<boolean> {
    if (!userId) return false;
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    return Boolean(user && this.roleFor(user) === UserRole.ADMIN);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!await this.isAdmin(context.switchToHttp().getRequest().user?.sub)) throw new ForbiddenException(this.message);
    return true;
  }
}
