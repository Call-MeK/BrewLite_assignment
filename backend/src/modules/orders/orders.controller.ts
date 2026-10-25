import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderIdParamDto } from './dto/order-id-param.dto';
import { OrderHistoryQueryDto } from './dto/order-history-query.dto';
import { OrdersService } from './orders.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('health')
  healthCheck() {
    return { module: 'Orders', status: 'Ready' };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.create(request.user.sub, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param() params: OrderIdParamDto,
  ) {
    return this.ordersService.cancel(params.id, request.user.sub);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyOrderHistory(
    @Req() request: AuthenticatedRequest,
    @Query() query: OrderHistoryQueryDto,
  ) {
    return this.ordersService.getOrderHistory(request.user.sub, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getMyOrderDetail(
    @Req() request: AuthenticatedRequest,
    @Param() params: OrderIdParamDto,
  ) {
    return this.ordersService.getOrderDetail(params.id, request.user.sub);
  }
}
