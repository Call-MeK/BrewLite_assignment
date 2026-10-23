import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

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
      sizePrices: product.sizePrices.map((sizePrice) => ({
        size: sizePrice.size,
        priceAdjustment: Number(sizePrice.priceAdjustment),
      })),
    }));
  }
}
