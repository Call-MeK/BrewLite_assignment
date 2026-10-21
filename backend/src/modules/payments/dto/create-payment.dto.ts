import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  orderId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}
