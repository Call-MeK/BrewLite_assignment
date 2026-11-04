import { Prisma, PrismaClient } from "@prisma/client";
import { sampleStockImport, sampleStockImportTotal } from "./stock-import-data";

const prisma = new PrismaClient();

const sample = sampleStockImport;

async function main() {
  const existing = await prisma.stockImport.findFirst({
    where: { supplier: sample.supplier, note: sample.note },
    select: { importNumber: true },
  });
  if (existing) {
    console.log(`Phiếu nhập mẫu đã tồn tại (#${existing.importNumber}), bỏ qua.`);
    return;
  }

  const ingredients = await prisma.ingredient.findMany({
    where: { name: { in: sample.items.map((item) => item.ingredientName) } },
    select: { id: true, name: true },
  });
  const byName = new Map(ingredients.map((item) => [item.name, item.id]));
  const missing = sample.items.filter((item) => !byName.has(item.ingredientName));
  if (missing.length) {
    throw new Error(
      `Thiếu nguyên liệu: ${missing.map((item) => item.ingredientName).join(", ")}`,
    );
  }

  const totalAmount = sampleStockImportTotal;

  const created = await prisma.$transaction(async (tx) => {
    const importRow = await tx.stockImport.create({
      data: {
        supplier: sample.supplier,
        note: sample.note,
        totalAmount: new Prisma.Decimal(totalAmount),
        createdBy: sample.createdBy,
        items: {
          create: sample.items.map((item) => ({
            ingredientId: byName.get(item.ingredientName)!,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: new Prisma.Decimal(item.quantity * item.unitPrice),
          })),
        },
      },
      select: { id: true, importNumber: true },
    });

    for (const item of sample.items) {
      await tx.ingredient.update({
        where: { id: byName.get(item.ingredientName)! },
        data: {
          stock: { increment: item.quantity },
          price: item.unitPrice,
          version: { increment: 1 },
        },
      });
    }

    return importRow;
  });

  console.log(
    `Đã tạo phiếu nhập mẫu #${created.importNumber} với ${sample.items.length} nguyên liệu, tổng ${totalAmount.toLocaleString("vi-VN")} đ.`,
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
