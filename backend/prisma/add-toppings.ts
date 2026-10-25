import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  for (const item of [
    { name: 'Vải', price: 8000, stock: 150 },
    { name: 'Đác thơm', price: 8000, stock: 150 },
    { name: 'Trân châu hoàng kim', price: 5000, stock: 200 },
  ]) {
    const existing = await prisma.topping.findFirst({ where: { name: item.name }, select: { id: true } });
    if (!existing) await prisma.topping.create({ data: item });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
