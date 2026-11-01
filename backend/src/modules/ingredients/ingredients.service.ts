import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service"; // Chỉnh lại đường dẫn nếu cần

@Injectable()
export class IngredientsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    name: string;
    unit: string;
    stock: number;
    price: number;
  }) {
    return this.prisma.ingredient.create({
      data: {
        name: data.name,
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
    data: { name?: string; unit?: string; stock?: number; price?: number },
  ) {
    return this.prisma.ingredient.update({
      where: { id },
      data,
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
