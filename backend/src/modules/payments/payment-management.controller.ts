import { Controller, Get, Header, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentManagementQueryDto } from './dto/payment-management-query.dto';
import { PaymentAdminGuard } from './payment-admin.guard';
import { PaymentManagementService } from './payment-management.service';

@Controller('admin/payments')
@UseGuards(JwtAuthGuard, PaymentAdminGuard)
export class PaymentManagementController {
  constructor(private readonly payments: PaymentManagementService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: PaymentManagementQueryDto) {
    return this.payments.list(query);
  }

  @Get('summary')
  @Header('Cache-Control', 'no-store')
  summary(@Query() query: PaymentManagementQueryDto) {
    return this.payments.summary(query);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(@Param('id') id: string) {
    return this.payments.detail(id);
  }
}
