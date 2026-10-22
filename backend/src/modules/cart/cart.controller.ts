import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Delete,
  HttpCode,
} from "@nestjs/common";
import { CartService } from "./cart.service";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";

@Controller("cart")
export class CartController {
  // Tiêm CartService vào để Controller có thể sai việc
  constructor(private readonly cartService: CartService) {}

  // 1. API Lấy chi tiết giỏ hàng (GET /api/v1/cart/{userId})
  // Ghi chú: Tạm thời truyền userId qua URL để test. Sau này ghép Auth thì sẽ lấy từ Token.
  @Get(":userId")
  async getCart(@Param("userId") userId: string) {
    const data = await this.cartService.getCartByUserId(userId);

    // Trả về đúng chuẩn Success Response Format của nhóm
    return {
      success: true,
      data: data,
    };
  }

  // 2. API Thêm món vào giỏ (POST /api/v1/cart/items)
  @Post("items")
  async addItem(
    @Body()
    body: {
      cartId: string;
      productId: string;
      quantity: number;
      size: any;
    },
  ) {
    const data = await this.cartService.addItemToCart(
      body.cartId,
      body.productId,
      body.quantity,
      body.size,
    );

    return {
      success: true,
      message: "Đã thêm món vào giỏ hàng",
      data: data,
    };
  }

  // 3. API Cập nhật số lượng (PATCH /api/v1/cart/items/{id})
  // Khớp 100% với Sequence Diagram lúc nãy
  @Patch("items/:id")
  @Patch("items/:id")
  async updateItem(@Param("id") itemId: string, @Body() updateDto: any) {
    const data = await this.cartService.updateItemDetails(itemId, updateDto);
    return {
      success: true,
      message: "Đã cập nhật chi tiết món nước",
      data,
    };
  }
  @Delete("items/:id")
  @HttpCode(200)
  async removeItem(@Param("id") itemId: string) {
    await this.cartService.removeItemFromCart(itemId);
    return {
      success: true,
      message: "Đã xóa món hàng khỏi giỏ",
    };
  }

  @Delete(":cartId/clear")
  @HttpCode(200)
  async clearCart(@Param("cartId") cartId: string) {
    const data = await this.cartService.clearCart(cartId);
    return {
      success: true,
      message: "Đã làm sạch toàn bộ giỏ hàng",
      deletedCount: data.count,
    };
  }
}
