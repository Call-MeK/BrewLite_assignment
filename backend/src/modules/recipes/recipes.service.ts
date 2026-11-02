import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { IngredientUnit, Prisma, ProductSize } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IngredientDto, SaveRecipeDto } from './recipes.dto';

const ingredientFields = { id: true, name: true, unit: true, _count: { select: { recipeItems: true } } } as const;
const publicIngredient = ({ _count, ...item }: Prisma.IngredientGetPayload<{ select: typeof ingredientFields }>) => ({ ...item, recipeCount: _count.recipeItems });

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog() {
    const [products, ingredients] = await this.prisma.$transaction([
      this.prisma.product.findMany({ select: { id: true, name: true, sizePrices: { select: { size: true, _count: { select: { recipeItems: true } } }, orderBy: { size: 'asc' } } }, orderBy: { name: 'asc' } }),
      this.prisma.ingredient.findMany({ select: ingredientFields, orderBy: { name: 'asc' } }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { products: products.map(({ sizePrices, ...product }) => ({ ...product, sizes: sizePrices.map(item => ({ size: item.size, ingredientCount: item._count.recipeItems })) })), ingredients: ingredients.map(publicIngredient) };
  }

  async createIngredient(dto: IngredientDto) {
    return this.prisma.ingredient.create({ data: { ...dto, nameKey: dto.name.toLowerCase() }, select: ingredientFields })
      .then(publicIngredient).catch(error => this.writeError(error));
  }

  async updateIngredient(id: string, dto: IngredientDto) {
    return this.prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ unit: IngredientUnit }[]>`SELECT unit FROM ingredients WHERE id = ${id} FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Không tìm thấy nguyên liệu');
      if (rows[0].unit !== dto.unit && await tx.recipeIngredient.count({ where: { ingredientId: id } })) {
        throw new ConflictException('Không thể đổi đơn vị nguyên liệu đang có trong công thức');
      }
      return publicIngredient(await tx.ingredient.update({ where: { id }, data: { ...dto, nameKey: dto.name.toLowerCase() }, select: ingredientFields }));
    }).catch(error => this.writeError(error));
  }

  async deleteIngredient(id: string) {
    return this.prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw`SELECT id FROM ingredients WHERE id = ${id} FOR UPDATE`;
      if (!(rows as unknown[]).length) throw new NotFoundException('Không tìm thấy nguyên liệu');
      if (await tx.recipeIngredient.count({ where: { ingredientId: id } })) throw new ConflictException('Nguyên liệu đang được dùng trong công thức');
      await tx.ingredient.delete({ where: { id } });
      return { id };
    }).catch(error => this.writeError(error));
  }

  async get(productId: string, size: ProductSize, db: Prisma.TransactionClient = this.prisma) {
    const productSize = await db.productSizePrice.findUnique({ where: { productId_size: { productId, size } }, select: {
      recipeItems: { select: { ingredientId: true, quantity: true, ingredient: { select: { name: true, unit: true } } }, orderBy: { ingredient: { name: 'asc' } } },
    } });
    if (!productSize) throw new NotFoundException('Sản phẩm không tồn tại hoặc không hỗ trợ size này');
    return { productId, size, items: productSize.recipeItems.map(({ ingredient, quantity, ...item }) => ({ ...item, ...ingredient, quantity: Number(quantity) })) };
  }

  async save(productId: string, size: ProductSize, dto: SaveRecipeDto) {
    return this.prisma.$transaction(async tx => {
      // Lock each product/size while replacing its complete recipe.
      const rows = await tx.$queryRaw`SELECT id FROM product_size_prices WHERE product_id = ${productId} AND size::text = ${size} FOR UPDATE`;
      if (!(rows as unknown[]).length) throw new NotFoundException('Sản phẩm không tồn tại hoặc không hỗ trợ size này');
      const ids = dto.items.map(item => item.ingredientId);
      if (ids.length) {
        // Shared locks prevent ingredient units changing or ingredients being deleted during a save.
        const ingredients = await tx.$queryRaw`SELECT id FROM ingredients WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`;
        if ((ingredients as unknown[]).length !== ids.length) throw new BadRequestException('Có nguyên liệu không tồn tại');
      }
      await tx.recipeIngredient.deleteMany({ where: { productId, size } });
      if (dto.items.length) await tx.recipeIngredient.createMany({ data: dto.items.map(item => ({ ...item, productId, size })) });
      return this.get(productId, size, tx);
    });
  }

  private writeError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictException('Tên nguyên liệu đã tồn tại');
      if (error.code === 'P2003') throw new ConflictException('Nguyên liệu đang được dùng trong công thức');
      if (error.code === 'P2025') throw new NotFoundException('Không tìm thấy nguyên liệu');
    }
    throw error;
  }
}
