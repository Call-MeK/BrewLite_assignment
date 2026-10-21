import { IsEnum, IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(/\S/)
  orderId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}
