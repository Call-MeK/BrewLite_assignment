import { Body, Controller, Get, Headers, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard, AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('health')
  healthCheck() {
    return { module: 'Payments', status: 'Ready for implementation (Task 8 & 10)' };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') key: string,
    @Res({ passthrough: true }) response: Response,
    @Headers('x-mock-outcome') outcome?: string,
  ) {
    const result = await this.payments.create(request.user.sub, dto, key, outcome);
    response.status(result.replayed || result.payment.status === 'FAILED' ? 200 : 201);
    return result.payment;
  }
}
