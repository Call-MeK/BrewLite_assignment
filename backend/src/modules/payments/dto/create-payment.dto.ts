import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^\S+$/)
  orderId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}

