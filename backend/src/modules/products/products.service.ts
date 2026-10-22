import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // Lấy danh sách sản phẩm.
  async getProducts() {
    const products = await this.prisma.product.findMany({
      where: { isAvailable: true, stock: { gt: 0 } },
      include: {
        category: { select: { name: true } },
        sizePrices: {
          select: { size: true, priceAdjustment: true },
          orderBy: { priceAdjustment: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      basePrice: Number(product.basePrice),
      imageUrl: product.imageUrl,
      isAvailable: product.isAvailable,
      categoryName: product.category?.name ?? null,
      sizePrices: product.sizePrices.map((item) => ({
        size: item.size,
        priceAdjustment: Number(item.priceAdjustment),
      })),
    }));
  }

  // Lấy chi tiết một sản phẩm theo ID.
  async getProductDetail(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { sizePrices: true },
    });

    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    const toppings = await this.prisma.topping.findMany({
      where: {
        isAvailable: true,
        stock: { gt: 0 },
      },
      orderBy: { name: 'asc' },
    });

    return {
      id: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      basePrice: Number(product.basePrice),
      currency: 'VND',
      isAvailable: product.isAvailable && product.stock > 0,
      sizePrices: product.sizePrices
        .sort(
          (a, b) =>
            ['S', 'M', 'L'].indexOf(a.size) -
            ['S', 'M', 'L'].indexOf(b.size),
        )
        .map((item) => ({
          size: item.size,
          priceAdjustment: Number(item.priceAdjustment),
        })),
      toppings: toppings.map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price),
      })),
    };
  }

}