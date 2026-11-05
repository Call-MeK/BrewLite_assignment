const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { PrismaClient } = require('@prisma/client');

if (!process.env.PAYMENT_TEST_DATABASE_URL) throw new Error('Set PAYMENT_TEST_DATABASE_URL to a disposable PostgreSQL schema');
process.env.DATABASE_URL = process.env.PAYMENT_TEST_DATABASE_URL;
process.env.JWT_SECRET = 'core-flow-test-only-secret';

const { AppModule } = require('../src/app.module');
const { TransformInterceptor } = require('../src/common/interceptors/transform.interceptor');
const { AllExceptionsFilter } = require('../src/common/filters/http-exception.filter');

const prisma = new PrismaClient();
const email = `${randomUUID()}@example.test`;
let app, base, userId, productId, ingredientId;

before(async () => {
  const ingredient = await prisma.ingredient.create({ data: { name: email, nameKey: email, unit: 'G', stock: 2 } });
  ingredientId = ingredient.id;
  const product = await prisma.product.create({
    data: { name: 'Core flow coffee', basePrice: 20000, stock: 0, sizePrices: { create: { size: 'M', recipeItems: { create: { ingredientId, quantity: 1 } } } } },
  });
  productId = product.id;
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  base = `${await app.getUrl()}/api/v1`;
});

after(async () => {
  if (app) await app.close();
  if (userId) {
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  }
  if (productId) await prisma.product.delete({ where: { id: productId } });
  if (ingredientId) await prisma.ingredient.delete({ where: { id: ingredientId } });
  await prisma.$disconnect();
});

async function request(path, method = 'GET', body, token) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { code: response.status, body: await response.json() };
}

test('registration, order, cancellation and password change work through HTTP and PostgreSQL', async () => {
  const password = 'first-password';
  const registered = await request('/auth/register', 'POST', { email, password, fullName: 'Core Test' });
  assert.equal(registered.code, 201);
  userId = registered.body.data.user.id;
  const oldToken = registered.body.data.accessToken;
  assert.equal((await request('/auth/me', 'GET', undefined, oldToken)).body.data.id, userId);

  const created = await request('/orders', 'POST', { items: [{ productId, size: 'M', quantity: 1 }] }, oldToken);
  assert.equal(created.code, 201);
  assert.equal(created.body.data.status, 'PENDING');
  assert.equal(await prisma.ingredient.findUnique({ where: { id: ingredientId } }).then((p) => p.stock), 1);
  const orderId = created.body.data.id;
  const history = await request('/orders/me', 'GET', undefined, oldToken);
  assert.equal(history.body.data.items.some((order) => order.id === orderId), true);
  assert.equal((await request(`/orders/${orderId}/cancel`, 'POST', undefined, oldToken)).body.data.status, 'CANCELLED');
  assert.equal(await prisma.ingredient.findUnique({ where: { id: ingredientId } }).then((p) => p.stock), 2);

  assert.equal((await request('/auth/login', 'POST', { email, password })).code, 200);
  const changed = await request('/auth/change-password', 'POST', { currentPassword: password, newPassword: 'second-password' }, oldToken);
  assert.equal(changed.code, 200);
  assert.equal((await request('/auth/me', 'GET', undefined, oldToken)).code, 401);
  assert.equal((await request('/auth/me', 'GET', undefined, changed.body.data.accessToken)).code, 200);
  assert.equal((await request('/auth/login', 'POST', { email, password })).code, 401);
  assert.equal((await request('/auth/login', 'POST', { email, password: 'second-password' })).code, 200);
});

test('concurrent orders cannot consume more ingredients than available', async () => {
  const login = await request('/auth/login', 'POST', { email, password: 'second-password' });
  const token = login.body.data.accessToken;
  const body = { items: [{ productId, size: 'M', quantity: 2 }] };
  const results = await Promise.all([request('/orders', 'POST', body, token), request('/orders', 'POST', body, token)]);
  assert.equal(results.filter(result => result.code === 201).length, 1);
  assert.equal(results.filter(result => [400, 409].includes(result.code)).length, 1);
  assert.equal((await prisma.ingredient.findUnique({ where: { id: ingredientId } })).stock, 0);
  const order = results.find(result => result.code === 201);
  assert.equal((await request(`/orders/${order.body.data.id}/cancel`, 'POST', undefined, token)).code, 200);
  assert.equal((await prisma.ingredient.findUnique({ where: { id: ingredientId } })).stock, 2);
});
