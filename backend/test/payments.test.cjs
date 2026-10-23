const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { PrismaClient } = require('@prisma/client');
const { AppModule } = require('../src/app.module');
const { TransformInterceptor } = require('../src/common/interceptors/transform.interceptor');
const { AllExceptionsFilter } = require('../src/common/filters/http-exception.filter');

// Requires a disposable database/schema; never defaults to the application database.
if (!process.env.PAYMENT_TEST_DATABASE_URL) throw new Error('Set PAYMENT_TEST_DATABASE_URL to a disposable PostgreSQL schema');
process.env.DATABASE_URL = process.env.PAYMENT_TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.PAYMENT_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'payment-test-only-secret';
const prisma = new PrismaClient();
const userId = `payment-test-${randomUUID()}`;
let app, base, token;
const orders = [];

before(async () => {
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.test`, passwordHash: 'not-a-login-password' } });
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  base = `${await app.getUrl()}/api/v1`;
  token = await app.get(JwtService).signAsync({ sub: userId, email: `${userId}@example.test`, ver: 0 });
});

after(async () => {
  await prisma.loyaltyTransaction.deleteMany({ where: { orderId: { in: orders } } });
  await prisma.order.deleteMany({ where: { id: { in: orders } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  if (app) await app.close();
  await prisma.$disconnect();
});

async function order(data = {}) {
  const row = await prisma.order.create({ data: { userId, totalAmount: 65999, finalAmount: 65999, ...data } });
  orders.push(row.id);
  return row;
}

async function pay(orderId, key = randomUUID(), outcome = 'SUCCESS', body = {}, auth = token) {
  const response = await fetch(`${base}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}`, 'Idempotency-Key': key, 'X-Mock-Outcome': outcome },
    body: JSON.stringify({ orderId, method: 'E_WALLET', ...body }),
  });
  return { code: response.status, body: await response.json() };
}

test('SUCCESS uses stored amount, pays order and awards floor loyalty once', async () => {
  const row = await order();
  const key = randomUUID();
  const balance = (await prisma.user.findUnique({ where: { id: userId } })).loyaltyPoints;
  const result = await pay(row.id, key);
  assert.equal(result.code, 201);
  assert.equal(result.body.statusCode, 201);
  assert.equal(result.body.data.status, 'SUCCESS');
  assert.equal(result.body.data.amount, 65999);
  const saved = await prisma.order.findUnique({ where: { id: row.id }, include: { statusHistory: true, loyaltyTransactions: true } });
  assert.equal(saved.status, 'PAID');
  assert.ok(saved.paidAt);
  assert.equal(saved.pointsEarned, 65);
  assert.equal(saved.statusHistory.length, 1);
  assert.equal(saved.loyaltyTransactions.length, 1);
  assert.equal(saved.loyaltyTransactions[0].points, 65);
  const replay = await pay(row.id, key);
  assert.equal(replay.code, 200);
  assert.equal(replay.body.statusCode, 200);
  assert.deepEqual(replay.body.data, result.body.data);
  assert.equal(await prisma.payment.count({ where: { orderId: row.id } }), 1);
  assert.equal((await prisma.user.findUnique({ where: { id: userId } })).loyaltyPoints, balance + 65);
  assert.equal((await pay(row.id)).code, 409);
});

test('FAILED persists reason without points; new key retries automatically and preserves history', async () => {
  const row = await order();
  const key = randomUUID();
  const failed = await pay(row.id, key, 'FAILED', { method: 'BANK_CARD' });
  assert.equal(failed.code, 200);
  assert.equal(failed.body.statusCode, 200);
  assert.equal(failed.body.data.status, 'FAILED');
  assert.ok(failed.body.data.failureReason);
  const saved = await prisma.order.findUnique({ where: { id: row.id } });
  assert.equal(saved.status, 'PAYMENT_FAILED');
  assert.equal(saved.paidAt, null);
  assert.equal(await prisma.loyaltyTransaction.count({ where: { orderId: row.id } }), 0);
  assert.equal((await pay(row.id, key, 'FAILED', { method: 'BANK_CARD' })).body.data.id, failed.body.data.id);
  assert.equal((await pay(row.id)).body.data.status, 'SUCCESS');
  assert.equal(await prisma.payment.count({ where: { orderId: row.id } }), 2);
  const history = await prisma.orderStatusHistory.findMany({ where: { orderId: row.id }, orderBy: { createdAt: 'asc' } });
  assert.deepEqual(history.map(h => [h.fromStatus, h.toStatus]), [['PENDING', 'PAYMENT_FAILED'], ['PAYMENT_FAILED', 'PENDING'], ['PENDING', 'PAID']]);
});

test('same key with changed method, order or demo outcome conflicts', async () => {
  const row = await order();
  const other = await order();
  const key = randomUUID();
  await pay(row.id, key);
  assert.equal((await pay(row.id, key, 'SUCCESS', { method: 'BANK_CARD' })).code, 409);
  assert.equal((await pay(row.id, key, 'FAILED')).code, 409);
  assert.equal((await pay(other.id, key)).code, 409);
});

test('concurrent distinct keys cannot both succeed or duplicate loyalty', async () => {
  const row = await order();
  const results = await Promise.all([pay(row.id), pay(row.id)]);
  assert.deepEqual(results.map(r => r.code).sort(), [201, 409]);
  assert.equal(await prisma.payment.count({ where: { orderId: row.id, status: 'SUCCESS' } }), 1);
  assert.equal(await prisma.loyaltyTransaction.count({ where: { orderId: row.id } }), 1);
});

test('concurrent same key replays completed payment without a 500', async () => {
  const row = await order();
  const key = randomUUID();
  const results = await Promise.all([pay(row.id, key), pay(row.id, key)]);
  assert.deepEqual(results.map(r => r.code).sort(), [200, 201]);
  assert.equal(results[0].body.data.id, results[1].body.data.id);
  assert.equal(await prisma.payment.count({ where: { orderId: row.id } }), 1);
});

test('global key collision across orders rolls back the losing order', async () => {
  const first = await order();
  const second = await order();
  const key = randomUUID();
  const results = await Promise.all([pay(first.id, key), pay(second.id, key)]);
  assert.deepEqual(results.map(r => r.code).sort(), [201, 409]);
  const loser = results[0].code === 409 ? first : second;
  assert.equal((await prisma.order.findUnique({ where: { id: loser.id } })).status, 'PENDING');
  assert.equal(await prisma.payment.count({ where: { orderId: loser.id } }), 0);
  assert.equal(await prisma.orderStatusHistory.count({ where: { orderId: loser.id } }), 0);
  assert.equal(await prisma.loyaltyTransaction.count({ where: { orderId: loser.id } }), 0);
});

test('BANK_CARD succeeds for a zero-point order', async () => {
  const row = await order({ totalAmount: 999, finalAmount: 999 });
  const result = await pay(row.id, randomUUID(), 'SUCCESS', { method: 'BANK_CARD' });
  assert.equal(result.code, 201);
  assert.equal(result.body.data.method, 'BANK_CARD');
  const saved = await prisma.order.findUnique({ where: { id: row.id }, include: { loyaltyTransactions: true } });
  assert.equal(saved.status, 'PAID');
  assert.equal(saved.pointsEarned, 0);
  assert.equal(saved.loyaltyTransactions.length, 1);
  assert.equal(saved.loyaltyTransactions[0].points, 0);
});

test('JWT and ownership are enforced even on idempotent replay', async () => {
  const row = await order();
  assert.equal((await pay(row.id, randomUUID(), 'SUCCESS', {}, 'invalid')).code, 401);
  const foreign = await order({ userId });
  // Existing user has a valid JWT but does not own this order.
  const outsider = await prisma.user.create({ data: { email: `${randomUUID()}@example.test`, passwordHash: 'test' } });
  try {
    const outsiderToken = await app.get(JwtService).signAsync({ sub: outsider.id, email: outsider.email, ver: 0 });
    const key = randomUUID();
    await pay(foreign.id, key);
    const result = await pay(foreign.id, key, 'SUCCESS', {}, outsiderToken);
    assert.equal(result.code, 403);
    assert.equal(result.body.data, undefined);
    assert.equal((await pay(row.id, randomUUID(), 'SUCCESS', {}, outsiderToken)).code, 403);
  } finally { await prisma.user.delete({ where: { id: outsider.id } }); }
});

test('pending payment is an explicit conflict and never reported as success', async () => {
  const row = await order();
  const key = randomUUID();
  const { createHash } = require('node:crypto');
  const requestHash = createHash('sha256').update(JSON.stringify({ orderId: row.id, method: 'E_WALLET', mockOutcome: 'SUCCESS' })).digest('hex');
  await prisma.payment.create({ data: { orderId: row.id, idempotencyKey: key, requestHash, amount: row.finalAmount, method: 'E_WALLET' } });
  assert.equal((await pay(row.id, key)).code, 409);
  assert.equal((await pay(row.id)).code, 409);
  assert.equal((await prisma.order.findUnique({ where: { id: row.id } })).status, 'PENDING');
});

test('invalid input and terminal orders are rejected without recording payment', async () => {
  const row = await order();
  for (const body of [{ method: 'CASH' }, { orderId: '' }, { amount: 1 }, { userId: 'attacker' }]) {
    assert.equal((await pay(row.id, randomUUID(), 'SUCCESS', body)).code, 400);
  }
  assert.equal((await pay(row.id, '')).code, 400);
  assert.equal((await pay(row.id, '   ')).code, 400);
  assert.equal((await pay(row.id, randomUUID(), 'OTHER')).code, 400);
  assert.equal((await pay('missing-order')).code, 404);
  for (const status of ['CANCELLED', 'PREPARING', 'READY', 'COMPLETED']) {
    const terminal = await order({ status });
    assert.equal((await pay(terminal.id)).code, 409);
  }
  assert.equal(await prisma.payment.count({ where: { orderId: row.id } }), 0);
});

test('production and disabled demo fail closed without payment writes', async () => {
  const { MockPaymentGatewayService } = require('../src/modules/payments/mock-payment-gateway.service');
  const { ConfigService } = require('@nestjs/config');
  for (const config of [{ NODE_ENV: 'production', PAYMENT_DEMO_MODE: 'true' }, { NODE_ENV: 'development', PAYMENT_DEMO_MODE: 'false' }, { NODE_ENV: 'staging', PAYMENT_DEMO_MODE: 'true' }]) {
    const gateway = new MockPaymentGatewayService(new ConfigService(config));
    assert.throws(() => gateway.resolveOutcome('SUCCESS'), e => e.getStatus() === 503);
    assert.throws(() => gateway.resolveOutcome(), e => e.getStatus() === 503);
  }
  const row = await order();
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.equal((await pay(row.id)).code, 503);
    assert.equal(await prisma.payment.count({ where: { orderId: row.id } }), 0);
    assert.equal((await prisma.order.findUnique({ where: { id: row.id } })).status, 'PENDING');
  } finally { process.env.NODE_ENV = previous; }
});

test('health endpoints stay public and other modules still respond', async () => {
  for (const module of ['payments', 'orders', 'auth']) {
    const response = await fetch(`${base}/${module}/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
  }
});

test('transaction failure rolls back payment, retry, history, paidAt and loyalty', async () => {
  const { PaymentsService } = require('../src/modules/payments/payments.service');
  const { OrdersService } = require('../src/modules/orders/orders.service');
  const { MockPaymentGatewayService } = require('../src/modules/payments/mock-payment-gateway.service');
  const row = await order({ status: 'PAYMENT_FAILED' });
  const balance = (await prisma.user.findUnique({ where: { id: userId } })).loyaltyPoints;
  const realOrders = app.get(OrdersService);
  const service = new PaymentsService(prisma, {
    transition: async (...args) => {
      const result = await realOrders.transition(...args);
      if (args[1] === 'PAID') throw new Error('Injected failure after loyalty write');
      return result;
    },
  }, app.get(MockPaymentGatewayService));
  await assert.rejects(service.create(userId, { orderId: row.id, method: 'E_WALLET' }, randomUUID(), 'SUCCESS'), /Injected failure/);
  const saved = await prisma.order.findUnique({ where: { id: row.id } });
  assert.equal(saved.status, 'PAYMENT_FAILED');
  assert.equal(saved.version, 0);
  assert.equal(saved.paidAt, null);
  assert.equal(saved.pointsEarned, 0);
  assert.equal(await prisma.payment.count({ where: { orderId: row.id } }), 0);
  assert.equal(await prisma.orderStatusHistory.count({ where: { orderId: row.id } }), 0);
  assert.equal(await prisma.loyaltyTransaction.count({ where: { orderId: row.id } }), 0);
  assert.equal((await prisma.user.findUnique({ where: { id: userId } })).loyaltyPoints, balance);
});
