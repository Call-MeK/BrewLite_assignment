import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProductSize } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { QueryProductDto } from "./dto/query-product.dto";

function availableQuantity(size: { recipeItems: { quantity: Prisma.Decimal; ingredient: { stock: number } }[] }) {
  if (!size.recipeItems.length) return 0;
  return Math.max(0, Math.floor(Math.min(...size.recipeItems.map((item) => item.ingredient.stock / Number(item.quantity)))));
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}
  async countTotal() {
    return this.prisma.product.count();
  }
  // nhánh product catalog
  async findAll(query: QueryProductDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;

    const where: Prisma.ProductWhereInput = {
      ...(query.search && {
        name: { contains: query.search, mode: "insensitive" },
      }),
      ...(query.categoryId && {
        category: {
          id: query.categoryId,
        },
      }),
      ...(query.isAvailable !== undefined && {
        isAvailable: query.isAvailable,
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          sizePrices: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
  async create(data: {
    name: string;
    categorySlug: string;
    basePrice: number;
    isAvailable: boolean;
  }) {
    return this.prisma.product.create({
      data: {
        name: data.name,
        // Dùng cú pháp connect để nối với Category
        category: {
          connect: { slug: data.categorySlug },
        },
        basePrice: data.basePrice,
        sizePrices: { create: [{ size: 'S' }, { size: 'M' }, { size: 'L' }] },
        isAvailable: data.isAvailable,
      },
    });
  }
  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, sizePrices: true },
    });
    if (!product) throw new NotFoundException("Không tìm thấy sản phẩm");
    return product;
  }

  findCategories() {
    return this.prisma.category.findMany({ orderBy: { displayOrder: "asc" } });
  }

  async getSizePrices(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, select: { sizePrices: { select: { size: true, priceAdjustment: true } } } });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
    return product.sizePrices.sort((a, b) => ['S', 'M', 'L'].indexOf(a.size) - ['S', 'M', 'L'].indexOf(b.size))
      .map((item) => ({ size: item.size, priceAdjustment: Number(item.priceAdjustment) }));
  }

  async updateSizePrices(id: string, sizes: { size: ProductSize; priceAdjustment: number }[]) {
    await this.prisma.$transaction(async (tx) => {
      for (const item of sizes) {
        const updated = await tx.productSizePrice.updateMany({ where: { productId: id, size: item.size }, data: { priceAdjustment: item.priceAdjustment } });
        if (!updated.count) throw new NotFoundException('Không tìm thấy sản phẩm hoặc size');
      }
    });
    return this.getSizePrices(id);
  }

  async getProducts() {
    const products = await this.prisma.product.findMany({
      include: {
        category: { select: { name: true } },
        sizePrices: {
          include: { recipeItems: { include: { ingredient: { select: { stock: true } } } } },
          orderBy: { priceAdjustment: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      basePrice: Number(product.basePrice),
      imageUrl: product.imageUrl,
      isAvailable: product.isAvailable && product.sizePrices.some((size) => availableQuantity(size) > 0),
      categoryName: product.category?.name ?? null,
      sizePrices: product.sizePrices.filter((item) => item.recipeItems.length > 0).map((item) => ({
        size: item.size,
        priceAdjustment: Number(item.priceAdjustment),
        isAvailable: product.isAvailable && availableQuantity(item) > 0,
        availableQuantity: availableQuantity(item),
      })),
    }));
  }

  // Lấy chi tiết một sản phẩm theo ID kèm theo Toppings (cho trang chi tiết)
  async getProductDetail(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { sizePrices: { include: { recipeItems: { include: { ingredient: { select: { stock: true } } } } } }, category: { select: { slug: true } } },
    });

    if (!product) {
      throw new NotFoundException("Không tìm thấy sản phẩm");
    }

    const toppings =
      product.category?.slug === "ca-phe"
        ? []
        : await this.prisma.topping.findMany({
            where: {
              isAvailable: true,
              stock: { gt: 0 },
              name: { in: ["Vải", "Đác thơm", "Trân châu hoàng kim"] },
            },
            orderBy: { name: "asc" },
          });

    return {
      id: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      basePrice: Number(product.basePrice),
      currency: "VND",
      categorySlug: product.category?.slug ?? null,
      isAvailable: product.isAvailable && product.sizePrices.some((size) => availableQuantity(size) > 0),
      sizePrices: product.sizePrices
        .filter((item) => item.recipeItems.length > 0)
        .sort(
          (a, b) =>
            ["S", "M", "L"].indexOf(a.size) - ["S", "M", "L"].indexOf(b.size),
        )
        .map((item) => ({
          size: item.size,
          priceAdjustment: Number(item.priceAdjustment),
          isAvailable: product.isAvailable && availableQuantity(item) > 0,
          availableQuantity: availableQuantity(item),
        })),
      toppings: toppings.map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price),
      })),
    };
  }

  // Lấy danh sách nguyên liệu cấu thành 1 sản phẩm
  async getRecipe(productId: string) {
    return this.prisma.recipeIngredient.findMany({ where: { productId }, include: { ingredient: { select: { id: true, name: true, unit: true, price: true } } } });
  }
  async addRecipeItem(productId: string, ingredientId: string, quantity: number) {
    return this.prisma.$transaction(async tx => {
      const sizes = await tx.productSizePrice.findMany({ where: { productId }, select: { size: true } });
      if (!sizes.length) throw new NotFoundException("S?n ph?m kh?ng c? size");
      return Promise.all(sizes.map(({ size }) => tx.recipeIngredient.upsert({ where: { productId_size_ingredientId: { productId, size, ingredientId } }, update: { quantity }, create: { productId, size, ingredientId, quantity } })));
    });
  }
  async removeRecipeItem(productId: string, ingredientId: string) {
    return this.prisma.recipeIngredient.deleteMany({ where: { productId, ingredientId } });
  }
  async remove(id: string) {
    return this.prisma.product.delete({
      where: { id },
    });
  }
}
