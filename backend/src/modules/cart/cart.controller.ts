import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get(':userId')
  getCart(@Req() request: AuthenticatedRequest, @Param('userId') userId: string) {
    if (userId !== request.user.sub) throw new ForbiddenException();
    return this.cartService.getCartByUserId(userId);
  }

  @Post('items')
  addItem(@Req() request: AuthenticatedRequest, @Body() body: AddCartItemDto) {
    return this.cartService.addItemToCart(request.user.sub, body);
  }

  @Patch('items/:id')
  updateItem(@Req() request: AuthenticatedRequest, @Param('id') itemId: string, @Body() dto: UpdateCartItemDto) {
    return this.cartService.updateItemDetails(request.user.sub, itemId, dto);
  }

  @Delete('items/:id')
  @HttpCode(200)
  removeItem(@Req() request: AuthenticatedRequest, @Param('id') itemId: string) {
    return this.cartService.removeItemFromCart(request.user.sub, itemId);
  }

  @Delete(':cartId/clear')
  @HttpCode(200)
  clearCart(@Req() request: AuthenticatedRequest, @Param('cartId') cartId: string) {
    return this.cartService.clearCart(request.user.sub, cartId);
  }
}
