import { Body, Controller, Get, Header, Headers, HttpCode, HttpException, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ZaloPaySandboxGateway } from './zalopay-sandbox.gateway';
import { ZaloPaySandboxService } from './zalopay-sandbox.service';

@Controller('payments/zalopay')
export class ZaloPaySandboxController {
  constructor(private readonly payments: ZaloPaySandboxService, private readonly gateway: ZaloPaySandboxGateway) {}

  @Get('config')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  config() { return { enabled: this.gateway.isConfigured() }; }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  create(@Req() req: Request & { user: JwtPayload }, @Body() dto: CreatePaymentDto, @Headers('idempotency-key') key: string) {
    return this.payments.create(req.user.sub, dto, key);
  }

  @Get('orders/:orderId')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  latest(@Req() req: Request & { user: JwtPayload }, @Param('orderId') id: string) {
    return this.payments.latest(id, req.user.sub);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  get(@Req() req: Request & { user: JwtPayload }, @Param('id') id: string) {
    return this.payments.get(id, req.user.sub);
  }

  @Post(':id/sync')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  sync(@Req() req: Request & { user: JwtPayload }, @Param('id') id: string) {
    return this.payments.sync(id, req.user.sub);
  }

  @Post('callback')
  async callback(@Body() body: unknown, @Res() response: Response) {
    // ZaloPay needs its own response format, outside the application's API envelope.
    try {
      response.status(200).json(await this.payments.callback(body));
    } catch (error) {
      const invalid = error instanceof HttpException && error.getStatus() < 500;
      response.status(200).json({ return_code: invalid ? -1 : 0, return_message: invalid ? 'Invalid callback' : 'Please retry' });
    }
  }
}
