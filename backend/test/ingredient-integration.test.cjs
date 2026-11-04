const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { OrdersService } = require('../src/modules/orders/orders.service');

test('cancelling restores the quantity reserved before a recipe change', async () => {
  if (!process.env.PAYMENT_TEST_DATABASE_URL) throw new Error('Disposable test database required');
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.PAYMENT_TEST_DATABASE_URL } } });
  const id = randomUUID();
  let order;
  try {
    await prisma.user.create({ data: { id, email: `${id}@example.test`, passwordHash: 'test' } });
    await prisma.ingredient.create({ data: { id, name: id, nameKey: id, unit: 'G', stock: 100 } });
    await prisma.product.create({ data: { id, name: id, basePrice: 100, stock: 10, sizePrices: { create: { size: 'M', recipeItems: { create: { ingredientId: id, quantity: 2.5 } } } } } });
    const service = new OrdersService(prisma);
    order = await service.create(id, { items: [{ productId: id, size: 'M', quantity: 2 }] });
    assert.equal((await prisma.ingredient.findUnique({ where: { id } })).stock, 95);
    await prisma.recipeIngredient.update({ where: { productId_size_ingredientId: { productId: id, size: 'M', ingredientId: id } }, data: { quantity: 9 } });
    await service.cancel(order.id, id);
    assert.equal((await prisma.ingredient.findUnique({ where: { id } })).stock, 100);
  } finally {
    if (order) await prisma.order.delete({ where: { id: order.id } });
    await prisma.product.deleteMany({ where: { id } });
    await prisma.ingredient.deleteMany({ where: { id } });
    await prisma.user.deleteMany({ where: { id } });
    await prisma.$disconnect();
  }
});
