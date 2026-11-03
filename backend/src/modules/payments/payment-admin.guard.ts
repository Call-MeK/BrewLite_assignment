import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PaymentAdminGuard extends AdminGuard {
  protected message = 'Bạn không có quyền quản lý thanh toán';
  constructor(config: ConfigService, prisma: PrismaService) { super(config, prisma); }
}
