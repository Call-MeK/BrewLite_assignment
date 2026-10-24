import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";
@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  // 2. HÀM TÌM GIỎ HÀNG CỦA USER
  async getCartByUserId(userId: string) {
    // Yêu cầu Prisma tìm giỏ hàng khớp với userId
    let cart = await this.prisma.cart.findUnique({
      where: { userId: userId },
      include: {
        items: true,
      },
    });

    // Nếu User chưa có giỏ hàng (lần đầu mua), hệ thống tự động tạo mới
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId: userId },
        include: { items: true },
      });
    }

    return cart;
  }
  // 3. THÊM MÓN VÀO GIỎ HÀNG
  async addItemToCart(
    cartId: string,
    productId: string,
    quantity: number,
    size: any,
  ) {
    // Tìm xem món này (cùng loại, cùng size) đã có trong giỏ chưa
    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cartId,
        productId: productId,
        size: size,
      },
    });

    if (existingItem) {
      // Nếu có rồi -> Cộng dồn số lượng
      return this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
      });
    }

    // Nếu chưa có -> Tạo dòng mới trong giỏ
    return this.prisma.cartItem.create({
      data: {
        cartId: cartId,
        productId: productId,
        quantity: quantity,
        size: size,
      },
    });
  }

  // 4. CẬP NHẬT SỐ LƯỢNG (Khớp với Sequence Diagram)
  async updateItemQuantity(itemId: string, updateDto: UpdateCartItemDto) {
    // Kiểm tra xem record này có tồn tại không
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException("Không tìm thấy món hàng này trong giỏ");
    }

    // Ra lệnh cho Prisma cập nhật
    return this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity: updateDto.quantity,
        ...(updateDto.size && { size: updateDto.size }), // Kỹ thuật rải object: Nếu có gửi size lên thì mới update size
      },
    });
  }
  // xóa theo ID
  async removeItemFromCart(itemId: string) {
    try {
      return await this.prisma.cartItem.delete({
        where: { id: itemId },
      });
    } catch (error) {
      throw new NotFoundException("Không tìm thấy món hàng này trong giỏ");
    }
  }

  async clearCart(cartId: string) {
    return this.prisma.cartItem.deleteMany({
      where: { cartId: cartId },
    });
  }
  async updateItemDetails(itemId: string, updateDto: any) {
    return this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        ...(updateDto.quantity !== undefined && {
          quantity: updateDto.quantity,
        }),
        ...(updateDto.size !== undefined && { size: updateDto.size }),
        ...(updateDto.toppingIds !== undefined && {
          toppingIds: updateDto.toppingIds,
        }),
      },
    });
  }
}
