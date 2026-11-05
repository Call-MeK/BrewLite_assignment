const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { PrismaClient } = require('@prisma/client');

if (!process.env.PAYMENT_TEST_DATABASE_URL || new URL(process.env.PAYMENT_TEST_DATABASE_URL).searchParams.get('schema') === 'public') throw new Error('A disposable test schema is required');
process.env.DATABASE_URL = process.env.PAYMENT_TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.REQUEST_LIMITS_ENABLED = 'false';
process.env.JWT_SECRET = 'admin-user-integration-test-only';
const { AppModule } = require('../src/app.module');
const { TransformInterceptor } = require('../src/common/interceptors/transform.interceptor');
const { AllExceptionsFilter } = require('../src/common/filters/http-exception.filter');
const prisma = new PrismaClient();
const id = randomUUID();
let app, base, admin, customer, adminToken, customerToken, productId, ingredientId, orderId;

before(async () => {
  admin = await prisma.user.create({ data: { email: `${id}-admin@example.test`, passwordHash: 'test', role: 'ADMIN' } });
  customer = await prisma.user.create({ data: { email: `${id}-customer@example.test`, passwordHash: 'test' } });
  await prisma.category.create({ data: { name: id, slug: id } });
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  base = `${await app.getUrl()}/api/v1`;
  const jwt = app.get(JwtService);
  adminToken = await jwt.signAsync({ sub: admin.id, email: admin.email, ver: 0 });
  customerToken = await jwt.signAsync({ sub: customer.id, email: customer.email, ver: 0 });
});

after(async () => {
  if (app) await app.close();
  if (orderId) await prisma.order.delete({ where: { id: orderId } });
  if (productId) await prisma.product.delete({ where: { id: productId } });
  if (ingredientId) await prisma.ingredient.delete({ where: { id: ingredientId } });
  await prisma.category.deleteMany({ where: { slug: id } });
  await prisma.user.deleteMany({ where: { id: { in: [admin?.id, customer?.id].filter(Boolean) } } });
  await prisma.$disconnect();
});

async function call(path, method = 'GET', token, body) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}

test('admin recipe and inventory control what a customer can order', async () => {
  assert.equal((await call('/ingredients')).status, 401);
  assert.equal((await call('/ingredients', 'GET', customerToken)).status, 403);
  const ingredient = await call('/ingredients', 'POST', adminToken, { name: id, unit: 'G', stock: 0, price: 1 });
  assert.equal(ingredient.status, 201);
  ingredientId = ingredient.body.data.id;
  const product = await call('/products', 'POST', adminToken, { name: id, categorySlug: id, basePrice: 20000, isAvailable: true });
  assert.equal(product.status, 201);
  productId = product.body.data.data.id;
  const pricesPath = `/products/${productId}/size-prices`;
  assert.equal((await call(pricesPath)).status, 401);
  assert.equal((await call(pricesPath, 'GET', customerToken)).status, 403);
  assert.deepEqual((await call(pricesPath, 'GET', adminToken)).body.data.map(item => item.size), ['S', 'M', 'L']);
  assert.equal((await call(pricesPath, 'PUT', customerToken, { sizes: [{ size: 'M', priceAdjustment: 5000 }] })).status, 403);
  assert.equal((await call(pricesPath, 'PUT', adminToken, { sizes: [{ size: 'M', priceAdjustment: -1 }] })).status, 400);
  assert.equal((await call(pricesPath, 'PUT', adminToken, { sizes: [{ size: 'M', priceAdjustment: 5000 }] })).status, 200);
  assert.equal((await call(`/products/${productId}`)).body.data.isAvailable, false);
  assert.equal((await call(`/admin/recipes/${productId}/M`, 'PUT', adminToken, { items: [{ ingredientId, quantity: 2 }] })).status, 200);
  assert.equal((await call(`/ingredients/${ingredientId}`, 'PATCH', adminToken, { stock: 3 })).status, 200);
  const detail = (await call(`/products/${productId}`)).body.data;
  assert.equal(detail.sizePrices.find(size => size.size === 'M').availableQuantity, 1);
  assert.equal(detail.sizePrices.find(size => size.size === 'M').priceAdjustment, 5000);
  assert.equal(detail.sizePrices.some(size => size.size === 'S'), false);
  const catalog = (await call('/admin/recipes/catalog', 'GET', adminToken)).body.data;
  assert.equal(catalog.products.find(item => item.id === productId).sizes.some(size => size.size === 'S' && size.ingredientCount === 0), true);
  const order = await call('/orders', 'POST', customerToken, { items: [{ productId, size: 'M', quantity: 1 }] });
  assert.equal(order.status, 201);
  assert.equal(order.body.data.totalAmount, 25000);
  orderId = order.body.data.id;
  assert.equal((await call(pricesPath, 'PUT', adminToken, { sizes: [{ size: 'M', priceAdjustment: 7000 }] })).status, 200);
  assert.equal((await call(`/orders/${orderId}`, 'GET', customerToken)).body.data.totalAmount, 25000);
  assert.equal((await call(`/products/${productId}`)).body.data.isAvailable, false);
  assert.equal((await call(`/orders/${orderId}/cancel`, 'POST', customerToken)).status, 200);
  assert.equal((await call(`/products/${productId}`)).body.data.isAvailable, true);
});
