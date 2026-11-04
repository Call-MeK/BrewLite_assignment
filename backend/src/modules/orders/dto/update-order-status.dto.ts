import { IsIn } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
  @IsIn([OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.COMPLETED])
  status: OrderStatus;
}
