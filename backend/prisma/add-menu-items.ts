import { PrismaClient, ProductSize } from '@prisma/client';
import { additionalMenuItems } from './additional-menu-items';

const prisma = new PrismaClient();

async function main() {
  for (const { categorySlug, ...item } of additionalMenuItems) {
    const category = await prisma.category.findUnique({ where: { slug: categorySlug } });
    if (!category) throw new Error(`Chưa có danh mục ${categorySlug}. Hãy tạo dữ liệu mẫu trước.`);
    const exists = await prisma.product.findFirst({
      where: { categoryId: category.id, name: item.name }, select: { id: true },
    });
    if (exists) continue;
    await prisma.product.create({
      data: {
        ...item,
        categoryId: category.id,
        sizePrices: {
          create: [
            { size: ProductSize.S, priceAdjustment: 0 },
            { size: ProductSize.M, priceAdjustment: 5000 },
            { size: ProductSize.L, priceAdjustment: 10000 },
          ],
        },
      },
    });
    console.log(`Đã thêm: ${item.name}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
