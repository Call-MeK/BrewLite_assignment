import { IngredientUnit } from "@prisma/client";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service"; // Chỉnh lại đường dẫn nếu cần

@Injectable()
export class IngredientsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    name: string;
    unit: IngredientUnit;
    stock: number;
    price: number;
  }) {
    return this.prisma.ingredient.create({
      data: {
        name: data.name,
        nameKey: data.name.toLowerCase(),
        unit: data.unit,
        stock: data.stock,
        price: data.price || 0,
      },
    });
  }

  async findAll() {
    return this.prisma.ingredient.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    return this.prisma.ingredient.findUnique({ where: { id } });
  }

  async update(
    id: string,
    data: { name?: string; unit?: IngredientUnit; stock?: number; price?: number },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ unit: IngredientUnit }[]>`SELECT unit FROM ingredients WHERE id = ${id} FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Không tìm thấy nguyên liệu');
      if (data.unit && data.unit !== rows[0].unit && await tx.recipeIngredient.count({ where: { ingredientId: id } })) {
        throw new ConflictException('Không thể đổi đơn vị nguyên liệu đang dùng trong công thức');
      }
      return tx.ingredient.update({
        where: { id },
        data: { ...data, version: { increment: 1 }, ...(data.name !== undefined ? { nameKey: data.name.toLowerCase() } : {}) },
      });
    });
  }

  async remove(id: string) {
    return this.prisma.ingredient.delete({ where: { id } });
  }
  async getLowStock(threshold: number = 500) {
    return this.prisma.ingredient.findMany({
      where: { stock: { lt: threshold } },
      orderBy: { stock: "asc" },
    });
  }
}
