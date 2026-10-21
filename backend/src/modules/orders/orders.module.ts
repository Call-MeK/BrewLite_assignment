import { Module, Controller, Get } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  @Get('health')
  healthCheck() {
    return { module: 'Orders', status: 'Ready for implementation (Task 6)' };
  }
}

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
