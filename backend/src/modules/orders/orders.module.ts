import { Module, Controller, Get } from '@nestjs/common';

@Controller('orders')
export class OrdersController {
  @Get('health')
  healthCheck() {
    return { module: 'Orders', status: 'Ready for implementation (Task 6)' };
  }
}

@Module({
  controllers: [OrdersController],
})
export class OrdersModule {}
