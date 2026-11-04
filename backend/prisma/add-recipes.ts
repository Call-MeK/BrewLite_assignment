import { PrismaClient, ProductSize } from "@prisma/client";
import { recipeQuantity, recipeTemplates } from "./recipes-data";

const prisma = new PrismaClient();
const sizes: ProductSize[] = [ProductSize.S, ProductSize.M, ProductSize.L];

async function main() {
  const [products, ingredients] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sizePrices: { select: { size: true } },
      },
    }),
    prisma.ingredient.findMany({ select: { id: true, name: true } }),
  ]);

  const ingredientByName = new Map(ingredients.map((item) => [item.name, item]));
  let createdSizes = 0;
  let skippedSizes = 0;

  for (const template of recipeTemplates) {
    const product = products.find((item) => item.name === template.productName);
    if (!product) {
      console.warn(`Bỏ qua công thức: chưa có sản phẩm "${template.productName}"`);
      continue;
    }

    const missing = template.ingredients.filter(
      (item) => !ingredientByName.has(item.ingredientName),
    );
    if (missing.length) {
      throw new Error(
        `Thiếu nguyên liệu cho ${template.productName}: ${missing.map((item) => item.ingredientName).join(", ")}`,
      );
    }

    const availableSizes = new Set(product.sizePrices.map((item) => item.size));
    for (const size of sizes.filter((item) => availableSizes.has(item))) {
      const existing = await prisma.recipeIngredient.count({
        where: { productId: product.id, size },
      });
      if (existing > 0) {
        skippedSizes += 1;
        continue;
      }

      await prisma.recipeIngredient.createMany({
        data: template.ingredients.map((item) => ({
          productId: product.id,
          size,
          ingredientId: ingredientByName.get(item.ingredientName)!.id,
          quantity: recipeQuantity(item.quantity, size),
        })),
      });
      createdSizes += 1;
      console.log(`Đã tạo công thức: ${product.name} — size ${size}`);
    }
  }

  console.log(
    `Hoàn tất: ${createdSizes} công thức theo size được tạo, ${skippedSizes} đã có sẵn.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
