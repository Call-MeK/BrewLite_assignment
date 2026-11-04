import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from '../../common/guards/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { OrderHistoryQueryDto } from './dto/order-history-query.dto';
import { OrderIdParamDto } from './dto/order-id-param.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query() query: OrderHistoryQueryDto) {
    return this.orders.getOrderHistory(undefined, query);
  }

  @Get(':id')
  detail(@Param() params: OrderIdParamDto) {
    return this.orders.getOrderDetail(params.id);
  }

  @Patch(':id/status')
  updateStatus(@Param() params: OrderIdParamDto, @Body() dto: UpdateOrderStatusDto, @Req() request: Request & { user: JwtPayload }) {
    return this.orders.updateStatus(params.id, dto.status, request.user.sub);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param() params: OrderIdParamDto, @Req() request: Request & { user: JwtPayload }) {
    return this.orders.cancel(params.id, undefined, request.user.sub);
  }
}
