import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { QueryProductDto } from "./dto/query-product.dto";

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

  async getProducts() {
    const products = await this.prisma.product.findMany({
      where: { isAvailable: true },
      include: {
        category: { select: { name: true } },
        sizePrices: {
          select: { size: true, priceAdjustment: true },
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
      isAvailable: product.isAvailable,
      categoryName: product.category?.name ?? null,
      sizePrices: product.sizePrices.map((item) => ({
        size: item.size,
        priceAdjustment: Number(item.priceAdjustment),
      })),
    }));
  }

  // Lấy chi tiết một sản phẩm theo ID kèm theo Toppings (cho trang chi tiết)
  async getProductDetail(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { sizePrices: true, category: { select: { slug: true } } },
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
      isAvailable: product.isAvailable,
      sizePrices: product.sizePrices
        .sort(
          (a, b) =>
            ["S", "M", "L"].indexOf(a.size) - ["S", "M", "L"].indexOf(b.size),
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

  // Lấy danh sách nguyên liệu cấu thành 1 sản phẩm
  async getRecipe(productId: string) {
    return this.prisma.recipeItem.findMany({
      where: { productId },
      include: {
        ingredient: {
          select: { id: true, name: true, unit: true, price: true },
        },
      },
    });
  }

  // Thêm hoặc cập nhật nguyên liệu vào công thức
  async addRecipeItem(
    productId: string,
    ingredientId: string,
    quantity: number,
  ) {
    // Dùng upsert: Nếu nguyên liệu đã có trong món này thì cập nhật số lượng, chưa có thì thêm mới
    return this.prisma.recipeItem.upsert({
      where: {
        productId_ingredientId: { productId, ingredientId },
      },
      update: { quantity },
      create: { productId, ingredientId, quantity },
    });
  }

  // Xóa nguyên liệu khỏi công thức
  async removeRecipeItem(productId: string, ingredientId: string) {
    return this.prisma.recipeItem.delete({
      where: {
        productId_ingredientId: { productId, ingredientId },
      },
    });
  }
  async remove(id: string) {
    await this.prisma.recipeItem.deleteMany({
      where: { productId: id },
    });

    return this.prisma.product.delete({
      where: { id },
    });
  }
}
