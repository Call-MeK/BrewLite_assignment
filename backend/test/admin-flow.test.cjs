require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { GUARDS_METADATA } = require('@nestjs/common/constants');
const { IngredientsController } = require('../src/modules/ingredients/ingredients.controller');
const { JwtAuthGuard } = require('../src/modules/auth/jwt-auth.guard');
const { AdminGuard } = require('../src/common/guards/admin.guard');
const { ProductsService } = require('../src/modules/products/products.service');
const { IngredientsService } = require('../src/modules/ingredients/ingredients.service');

test('ingredient management requires an authenticated administrator', () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, IngredientsController), [JwtAuthGuard, AdminGuard]);
});

test('new product creates sizes without requiring finished-product stock', async () => {
  let args;
  const service = new ProductsService({ product: { create: async (value) => { args = value; return value; } } });
  await service.create({ name: 'Tea', categorySlug: 'tea', basePrice: 30000, isAvailable: true });
  assert.equal(args.data.stock, undefined);
  assert.deepEqual(args.data.sizePrices.create.map(size => size.size), ['S', 'M', 'L']);
});

test('changing ingredient inventory increments its version', async () => {
  let args;
  const tx = { $queryRaw: async () => [{ unit: 'G' }], ingredient: { update: async (value) => { args = value; return value; } } };
  const service = new IngredientsService({ $transaction: async (fn) => fn(tx) });
  await service.update('ingredient', { stock: 5 });
  assert.deepEqual(args.data.version, { increment: 1 });
});
