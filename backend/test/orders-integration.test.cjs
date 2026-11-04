const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { PrismaClient } = require('@prisma/client');
const { AppModule } = require('../src/app.module');
const { OrdersService } = require('../src/modules/orders/orders.service');
const { TransformInterceptor } = require('../src/common/interceptors/transform.interceptor');
const { AllExceptionsFilter } = require('../src/common/filters/http-exception.filter');

const databaseUrl = process.env.PAYMENT_TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).searchParams.get('schema') || new URL(databaseUrl).searchParams.get('schema') === 'public') {
  throw new Error('An explicit disposable PostgreSQL schema is required');
}
process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = 'test';
process.env.REQUEST_LIMITS_ENABLED = 'false';
process.env.PAYMENT_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'orders-integration-test-only';
const prisma = new PrismaClient();
const owner = randomUUID(), admin = randomUUID(), outsider = randomUUID(), productId = randomUUID();
const ids = [];
let app, base, service, tokens;

before(async () => {
  for (const id of [owner, admin, outsider]) {
    await prisma.user.create({ data: { id, email: `${id}@example.test`, passwordHash: 'test', role: id === admin ? 'ADMIN' : 'CUSTOMER' } });
  }
  await prisma.ingredient.create({ data: { id: productId, name: productId, nameKey: productId, unit: 'G', stock: 1000 } });
  await prisma.product.create({ data: { id: productId, name: productId, basePrice: 30000, stock: 100, sizePrices: { create: { size: 'M', recipeItems: { create: { ingredientId: productId, quantity: 2.5 } } } } } });
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  base = `${await app.getUrl()}/api/v1`;
  service = new OrdersService(prisma);
  tokens = Object.fromEntries(await Promise.all([owner, admin, outsider].map(async id => [id, await app.get(JwtService).signAsync({ sub: id, email: `${id}@example.test`, ver: 0 })])));
});

after(async () => {
  if (app) await app.close();
  await prisma.loyaltyTransaction.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.ingredient.deleteMany({ where: { id: productId } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, admin, outsider] } } });
  await prisma.$disconnect();
});

async function request(path, actor = owner, method = 'GET', body, headers = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${tokens[actor]}` } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { code: response.status, body: await response.json() };
}
async function order(pointsToUse = 0) {
  const row = await service.create(owner, { items: [{ productId, quantity: 1, size: 'M' }], pointsToUse });
  ids.push(row.id);
  return row;
}
async function pay(id) {
  return request('/payments', owner, 'POST', { orderId: id, method: 'E_WALLET' }, { 'Idempotency-Key': randomUUID(), 'X-Mock-Outcome': 'SUCCESS' });
}

test('admin orders enforce authentication/role, owner scope, filtering and sequential preparation', async () => {
  const row = await order();
  assert.equal((await request('/admin/orders', null)).code, 401);
  assert.equal((await request('/admin/orders', owner)).code, 403);
  assert.equal((await request(`/admin/orders/${row.id}`, owner)).code, 403);
  assert.equal((await request(`/orders/${row.id}`, outsider)).code, 404);
  assert.equal((await request(`/orders/${row.id}/cancel`, outsider, 'POST')).code, 404);
  assert.equal((await pay(row.id)).code, 201);
  const list = await request('/admin/orders?status=PAID&limit=1&page=1', admin);
  assert.equal(list.code, 200);
  assert.equal(list.body.data.items.length, 1);
  assert.equal(list.body.data.items[0].status, 'PAID');
  assert.ok(list.body.data.items[0].customer.email);
  assert.equal((await request('/admin/orders?limit=100', admin)).code, 400);
  assert.equal((await request(`/admin/orders/${row.id}/status`, owner, 'PATCH', { status: 'PREPARING' })).code, 403);
  assert.equal((await request(`/admin/orders/${row.id}/status`, admin, 'PATCH', { status: 'READY' })).code, 409);
  assert.equal((await request(`/admin/orders/${row.id}/status`, admin, 'PATCH', { status: 'CANCELLED' })).code, 400);
  for (const status of ['PREPARING', 'READY', 'COMPLETED']) {
    assert.equal((await request(`/admin/orders/${row.id}/status`, admin, 'PATCH', { status })).code, 200);
    assert.equal((await request(`/orders/${row.id}/cancel`, owner, 'POST')).code, 409);
  }
  const detail = await request(`/admin/orders/${row.id}`, admin);
  assert.equal(detail.body.data.customer.id, owner);
  assert.equal(detail.body.data.payments[0].source, 'MOCK');
  assert.equal(detail.body.data.statusHistory.at(-1).toStatus, 'COMPLETED');
});

test('concurrent paid cancellation restores snapshot and spent points once, permits negative balance, records manual refund', async () => {
  await prisma.user.update({ where: { id: owner }, data: { loyaltyPoints: 10 } });
  const stock = await prisma.product.findUnique({ where: { id: productId } });
  const ingredient = await prisma.ingredient.findUnique({ where: { id: productId } });
  const row = await order(10);
  assert.equal((await pay(row.id)).code, 201);
  await prisma.user.update({ where: { id: owner }, data: { loyaltyPoints: 0 } });
  await prisma.recipeIngredient.update({ where: { productId_size_ingredientId: { productId, size: 'M', ingredientId: productId } }, data: { quantity: 7 } });
  const results = await Promise.all([request(`/orders/${row.id}/cancel`, owner, 'POST'), request(`/admin/orders/${row.id}/cancel`, admin, 'POST')]);
  assert.ok(results.some(result => result.code === 200));
  assert.ok(results.every(result => [200, 409].includes(result.code)));
  assert.equal((await request(`/orders/${row.id}/cancel`, owner, 'POST')).code, 200);
  const saved = await prisma.order.findUnique({ where: { id: row.id }, include: { loyaltyTransactions: true, payments: true } });
  assert.equal(saved.status, 'CANCELLED');
  assert.equal(saved.refundStatus, 'MANUAL_REQUIRED');
  assert.equal(saved.payments[0].status, 'SUCCESS');
  assert.equal(saved.loyaltyTransactions.filter(item => item.type === 'REVERSED').length, 1);
  assert.equal(saved.loyaltyTransactions.filter(item => item.type === 'REFUNDED').length, 1);
  assert.equal((await prisma.user.findUnique({ where: { id: owner } })).loyaltyPoints, -19);
  assert.equal((await prisma.product.findUnique({ where: { id: productId } })).stock, stock.stock);
  assert.equal((await prisma.ingredient.findUnique({ where: { id: productId } })).stock, ingredient.stock);
  assert.equal((await request(`/orders/${row.id}`)).body.data.refundStatus, 'MANUAL_REQUIRED');
});

test('preparation versus cancellation has exactly one winner', async () => {
  const row = await order();
  await pay(row.id);
  const responses = await Promise.all([request(`/orders/${row.id}/cancel`, owner, 'POST'), request(`/admin/orders/${row.id}/status`, admin, 'PATCH', { status: 'PREPARING' })]);
  assert.deepEqual(responses.map(result => result.code).sort(), [200, 409]);
  const saved = await prisma.order.findUnique({ where: { id: row.id }, include: { loyaltyTransactions: true } });
  assert.equal(saved.refundStatus, saved.status === 'CANCELLED' ? 'MANUAL_REQUIRED' : 'NONE');
  assert.equal(saved.loyaltyTransactions.filter(item => item.type === 'REVERSED').length, saved.status === 'CANCELLED' ? 1 : 0);
});

test('payment versus cancellation cannot leave a paid cancelled order without manual refund or reverse points twice', async () => {
  const row = await order();
  const responses = await Promise.all([pay(row.id), request(`/orders/${row.id}/cancel`, owner, 'POST')]);
  assert.ok(responses.every(result => [200, 201, 409].includes(result.code)));
  const saved = await prisma.order.findUnique({ where: { id: row.id }, include: { loyaltyTransactions: true } });
  const earned = saved.loyaltyTransactions.filter(item => item.type === 'EARNED');
  const reversed = saved.loyaltyTransactions.filter(item => item.type === 'REVERSED');
  assert.ok(earned.length <= 1);
  if (saved.status === 'CANCELLED') {
    assert.equal(reversed.length, earned.length);
    assert.equal(saved.refundStatus, earned.length ? 'MANUAL_REQUIRED' : 'NONE');
  }
});

test('expiry cancellation refuses a freshly paid order', async () => {
  const row = await order();
  await pay(row.id);
  await assert.rejects(service.cancel(row.id, owner, 'system', true), { status: 409 });
  assert.equal((await prisma.order.findUnique({ where: { id: row.id } })).status, 'PAID');
});
