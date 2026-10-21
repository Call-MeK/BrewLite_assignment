import {
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly prisma: PrismaService) {}

  // GET /api/v1/products
  // Lấy danh sách sản phẩm từ database.
  @Get()
  async getProducts() {
    const products = await this.prisma.product.findMany({
      orderBy: { name: 'asc' },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      basePrice: Number(product.basePrice),
      isAvailable: product.isAvailable && product.stock > 0,
    }));
  }

  // GET /api/v1/products/:id
  // Lấy thông tin chi tiết của một sản phẩm.
  @Get(':id')
  async getProductDetail(@Param('id') id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        sizePrices: true,
      },
    });

    // Không tìm thấy sản phẩm thì trả về HTTP 404.
    if (!product) {
      throw new NotFoundException(
        'Không tìm thấy sản phẩm với ID cung cấp',
      );
    }

    // Chỉ lấy topping đang bán và còn hàng.
    const toppings = await this.prisma.topping.findMany({
      where: {
        isAvailable: true,
        stock: { gt: 0 },
      },
      orderBy: { name: 'asc' },
    });

    // Chuẩn hóa dữ liệu theo API contract của dự án.
    return {
      id: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      basePrice: Number(product.basePrice),
      currency: 'VND',
      isAvailable: product.isAvailable && product.stock > 0,
      sizePrices: product.sizePrices
        .sort((a, b) => a.size.localeCompare(b.size))
        .map((item) => ({
          size: item.size,
          priceAdjustment: Number(item.priceAdjustment),
        })),
      toppings: toppings.map((topping) => ({
        id: topping.id,
        name: topping.name,
        price: Number(topping.price),
      })),
    };
  }
}

@Module({
  controllers: [ProductsController],
})
export class ProductsModule {}