import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockPaymentGatewayService } from './mock-payment-gateway.service';

@Module({
  imports: [AuthModule, OrdersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, MockPaymentGatewayService],
})
export class PaymentsModule {}
