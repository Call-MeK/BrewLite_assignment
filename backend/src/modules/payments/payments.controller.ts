import { Body, Controller, Get, Headers, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { PaymentRequest, PaymentAuthGuard } from './payment-auth.guard';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ZaloPayCallbackDto } from './dto/zalopay-callback.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('health')
  healthCheck() {
    return { module: 'Payments', status: 'ZaloPay sandbox v2' };
  }

  @Post()
  @UseGuards(PaymentAuthGuard)
  async create(
    @Req() request: PaymentRequest,
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') key: string,
    @Res() response: Response,
  ) {
    const result = await this.payments.create(request.user.sub, dto, key);
    const statusCode = result.replayed || result.payment.status === 'FAILED' ? 200 : 201;
    response.status(statusCode).json({
      success: true, statusCode, data: result.payment, timestamp: new Date().toISOString(),
    });
  }

  @Get('orders/:orderId')
  @UseGuards(PaymentAuthGuard)
  getOrder(@Req() request: PaymentRequest, @Param('orderId') id: string) {
    return this.payments.getOrder(request.user.sub, id);
  }

  @Get(':id')
  @UseGuards(PaymentAuthGuard)
  get(@Req() request: PaymentRequest, @Param('id') id: string) {
    return this.payments.get(request.user.sub, id);
  }

  @Post('zalopay/callback')
  async callback(@Body() dto: ZaloPayCallbackDto, @Res() response: Response) {
    response.status(200).json(await this.payments.callback(dto));
  }
}
