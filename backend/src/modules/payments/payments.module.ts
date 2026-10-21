import { Module, Controller, Get } from '@nestjs/common';

@Controller('payments')
export class PaymentsController {
  @Get('health')
  healthCheck() {
    return { module: 'Payments', status: 'Ready for implementation (Task 8 & 10)' };
  }
}

@Module({
  controllers: [PaymentsController],
})
export class PaymentsModule {}
