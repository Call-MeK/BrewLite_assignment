import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PaymentAuthGuard } from './payment-auth.guard';
import { PaymentOrderService } from './payment-order.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ZaloPayService } from './zalopay.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PaymentsController],
  providers: [PaymentsService, ZaloPayService, PaymentAuthGuard, PaymentOrderService],
})
export class PaymentsModule {}
