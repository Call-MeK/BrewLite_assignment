import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockPaymentGatewayService } from './mock-payment-gateway.service';
import { PaymentAdminGuard } from './payment-admin.guard';
import { PaymentManagementController } from './payment-management.controller';
import { PaymentManagementService } from './payment-management.service';
import { ZaloPaySandboxController } from './zalopay-sandbox.controller';
import { ZaloPaySandboxGateway } from './zalopay-sandbox.gateway';
import { ZaloPaySandboxService } from './zalopay-sandbox.service';

@Module({
  imports: [AuthModule, OrdersModule],
  controllers: [PaymentsController, PaymentManagementController, ZaloPaySandboxController],
  providers: [PaymentsService, MockPaymentGatewayService, PaymentAdminGuard, PaymentManagementService, ZaloPaySandboxGateway, ZaloPaySandboxService],
})
export class PaymentsModule {}
