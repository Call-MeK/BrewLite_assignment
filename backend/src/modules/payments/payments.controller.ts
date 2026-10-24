import { Body, Controller, Get, Headers, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('health')
  healthCheck() {
    return { module: 'Payments', status: 'Ready' };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Req() request: Request & { user: JwtPayload },
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') key: string,
    @Headers('x-mock-outcome') outcome: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.payments.create(request.user.sub, dto, key, outcome);
    response.status(result.replayed || result.payment.status === 'FAILED' ? 200 : 201);
    return result.payment;
  }
}
