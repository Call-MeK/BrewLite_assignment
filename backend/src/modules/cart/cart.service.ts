import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductSize } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  getCartByUserId(userId: string) {
    return this.prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: { items: true },
    });
  }

  async addItemToCart(userId: string, dto: AddCartItemDto) {
    await this.requireCart(dto.cartId, userId);
    const toppingIds = [...(dto.toppingIds ?? [])].sort();
    await this.requireSelection(dto.productId, dto.size, toppingIds);

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM carts WHERE id = ${dto.cartId} FOR UPDATE`;
      const existing = await tx.cartItem.findFirst({
        where: { cartId: dto.cartId, productId: dto.productId, size: dto.size, toppingIds: { equals: toppingIds } },
      });
      if (existing) {
        if (existing.quantity + dto.quantity > 99) throw new BadRequestException('Số lượng tối đa là 99');
        const updated = await tx.cartItem.updateMany({
          where: {
            id: existing.id,
            productId: dto.productId,
            size: dto.size,
            toppingIds: { equals: toppingIds },
            quantity: { lte: 99 - dto.quantity },
          },
          data: { quantity: { increment: dto.quantity } },
        });
        if (updated.count !== 1) throw new BadRequestException('Giỏ hàng vừa thay đổi hoặc vượt số lượng 99');
        return tx.cartItem.findUnique({ where: { id: existing.id } });
      }
      return tx.cartItem.create({
        data: { cartId: dto.cartId, productId: dto.productId, quantity: dto.quantity, size: dto.size, toppingIds },
      });
    });
  }

  async updateItemDetails(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.requireItem(itemId, userId);
    if (dto.size !== undefined || dto.toppingIds !== undefined) {
      await this.requireSelection(item.productId, dto.size ?? item.size, dto.toppingIds ?? item.toppingIds);
    }
    return this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        ...(dto.size !== undefined ? { size: dto.size } : {}),
        ...(dto.toppingIds !== undefined ? { toppingIds: [...dto.toppingIds].sort() } : {}),
      },
    });
  }

  async removeItemFromCart(userId: string, itemId: string) {
    await this.requireItem(itemId, userId);
    return this.prisma.cartItem.delete({ where: { id: itemId } });
  }

  async clearCart(userId: string, cartId: string) {
    await this.requireCart(cartId, userId);
    return this.prisma.cartItem.deleteMany({ where: { cartId } });
  }

  private async requireCart(cartId: string, userId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { id: cartId }, select: { userId: true } });
    if (!cart) throw new NotFoundException('Không tìm thấy giỏ hàng');
    if (cart.userId !== userId) throw new ForbiddenException();
  }

  private async requireItem(itemId: string, userId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: { select: { userId: true } } },
    });
    if (!item) throw new NotFoundException('Không tìm thấy món hàng trong giỏ');
    if (item.cart.userId !== userId) throw new ForbiddenException();
    return item;
  }

  private async requireSelection(productId: string, size: ProductSize, toppingIds: string[]) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { isAvailable: true, stock: true, sizePrices: { where: { size }, select: { id: true } } },
    });
    if (!product?.isAvailable || product.stock < 1 || product.sizePrices.length === 0) {
      throw new BadRequestException('Sản phẩm hoặc kích cỡ không khả dụng');
    }
    if (toppingIds.length > 0) {
      const count = await this.prisma.topping.count({
        where: { id: { in: toppingIds }, isAvailable: true, stock: { gt: 0 } },
      });
      if (count !== toppingIds.length) throw new BadRequestException('Topping không khả dụng');
    }
  }
}
