import { PrismaClient } from "@prisma/client";
import { ingredientSeeds } from "./ingredients-data";

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  let skipped = 0;

  for (const item of ingredientSeeds) {
    const nameKey = item.name.toLowerCase();
    const existing = await prisma.ingredient.findUnique({
      where: { nameKey },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.ingredient.create({
      data: {
        name: item.name,
        nameKey,
        unit: item.unit,
        stock: item.stock,
        price: item.price,
      },
    });
    created += 1;
    console.log(`Đã thêm nguyên liệu: ${item.name}`);
  }

  console.log(`Hoàn tất: ${created} nguyên liệu mới, ${skipped} đã tồn tại.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
