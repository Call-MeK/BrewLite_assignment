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
let app, base, userId, productId;

before(async () => {
  const product = await prisma.product.create({
    data: { name: 'Core flow coffee', basePrice: 20000, stock: 2, sizePrices: { create: { size: 'M' } } },
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
  assert.equal(await prisma.product.findUnique({ where: { id: productId } }).then((p) => p.stock), 1);
  const orderId = created.body.data.id;
  const history = await request('/orders/me', 'GET', undefined, oldToken);
  assert.equal(history.body.data.items.some((order) => order.id === orderId), true);
  assert.equal((await request(`/orders/${orderId}/cancel`, 'POST', undefined, oldToken)).body.data.status, 'CANCELLED');
  assert.equal(await prisma.product.findUnique({ where: { id: productId } }).then((p) => p.stock), 2);

  await prisma.product.update({ where: { id: productId }, data: { stock: 1 } });
  const beforeOrders = await prisma.order.count({ where: { userId } });
  const concurrent = await Promise.all([
    request('/orders', 'POST', { items: [{ productId, size: 'M', quantity: 1 }] }, oldToken),
    request('/orders', 'POST', { items: [{ productId, size: 'M', quantity: 1 }] }, oldToken),
  ]);
  assert.equal(concurrent.filter((result) => result.code === 201).length, 1);
  assert.equal(concurrent.filter((result) => result.code === 400 || result.code === 409).length, 1);
  assert.equal(await prisma.order.count({ where: { userId } }), beforeOrders + 1);
  assert.equal(await prisma.product.findUnique({ where: { id: productId } }).then((p) => p.stock), 0);

  assert.equal((await request('/auth/login', 'POST', { email, password })).code, 200);
  const changed = await request('/auth/change-password', 'POST', { currentPassword: password, newPassword: 'second-password' }, oldToken);
  assert.equal(changed.code, 200);
  assert.equal((await request('/auth/me', 'GET', undefined, oldToken)).code, 401);
  assert.equal((await request('/auth/me', 'GET', undefined, changed.body.data.accessToken)).code, 200);
  assert.equal((await request('/auth/login', 'POST', { email, password })).code, 401);
  assert.equal((await request('/auth/login', 'POST', { email, password: 'second-password' })).code, 200);
});
