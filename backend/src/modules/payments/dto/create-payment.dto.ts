import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  @Matches(/\S/)
  orderId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}
