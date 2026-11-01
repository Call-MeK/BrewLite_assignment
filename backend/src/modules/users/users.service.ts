import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersQueryDto } from './users.dto';

const publicFields = { id: true, email: true, fullName: true, loyaltyPoints: true, createdAt: true, role: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly admins: AdminGuard) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    return { id: user.id, role: this.admins.roleFor(user) };
  }

  async list(query: UsersQueryDto) {
    const conditions: Prisma.UserWhereInput[] = [];
    const adminIds = [...this.admins.adminIds];
    if (query.role === 'ADMIN') conditions.push({ OR: [{ role: 'ADMIN' }, { role: null, id: { in: adminIds } }] });
    if (query.role === 'CUSTOMER') conditions.push({ OR: [{ role: 'CUSTOMER' }, { role: null, id: { notIn: adminIds } }] });
    const search = query.search?.trim();
    if (search) conditions.push({ OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] });
    const where: Prisma.UserWhereInput = { AND: conditions };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, select: { ...publicFields, _count: { select: { orders: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.limit, take: query.limit }),
      this.prisma.user.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { items: users.map(({ _count, ...user }) => ({ ...user, role: this.admins.roleFor(user), orderCount: _count.orders })),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async setRole(actorId: string, userId: string, role: UserRole) {
    if (actorId === userId) throw new BadRequestException('Không thể tự thay đổi quyền của mình');
    return this.prisma.$transaction(async tx => {
      // Serialize changes and recheck the actor to prevent concurrent admins demoting each other.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73521001)`;
      if (!await this.admins.isAdmin(actorId, tx)) throw new ForbiddenException('Bạn không còn quyền quản trị');
      if (!await tx.user.findUnique({ where: { id: userId }, select: { id: true } })) throw new NotFoundException('Không tìm thấy tài khoản');
      return tx.user.update({ where: { id: userId }, data: { role }, select: publicFields });
    });
  }
}
