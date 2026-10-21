const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const { Test } = require('@nestjs/testing');
const { JwtService } = require('@nestjs/jwt');
const { ValidationPipe } = require('@nestjs/common');

// Each run owns a fresh schema; never reset the application's schema.
const schema = `payment_test_${randomUUID().replaceAll('-', '')}`;
const url = new URL(process.env.PAYMENT_TEST_DATABASE_URL || process.env.DATABASE_URL);
url.searchParams.set('schema', schema);
process.env.DATABASE_URL = url.toString();
process.env.NODE_ENV = 'test';
process.env.PAYMENT_DEMO_MODE = 'true';
process.env.JWT_SECRET = randomUUID();
const { AppModule } = require('../src/app.module');
const { TransformInterceptor } = require('../src/common/interceptors/transform.interceptor');
const { AllExceptionsFilter } = require('../src/common/filters/http-exception.filter');
const db = new PrismaClient();
const jwt = new JwtService({ secret: process.env.JWT_SECRET });
let app, base, schemaCreated = false;

before(async () => {
  const push = spawnSync(process.execPath,
    ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'],
    { env: process.env, encoding: 'utf8' });
  assert.equal(push.status, 0, push.stdout + push.stderr);
  schemaCreated = true;
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});

after(async () => {
  if (app) await app.close();
  if (schemaCreated) await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
});

test('FAILED keeps paidAt empty and earns no loyalty; retry with a new key records all transitions', async () => {
  const f = await fixture();
  const failed = await pay(f, randomUUID(), 'FAILED', { method: 'BANK_CARD' });
  assert.equal(failed.status, 200);
  assert.equal(failed.body.statusCode, 200);
  assert.equal(failed.body.data.status, 'FAILED');
  assert.ok(failed.body.data.failureReason);
  let order = await db.order.findUnique({ where: { id: f.order.id }, include: { user: true } });
  assert.equal(order.status, 'PAYMENT_FAILED');
  assert.equal(order.paidAt, null);
  assert.equal(order.user.loyaltyPoints, 0);
  assert.equal(await db.loyaltyTransaction.count({ where: { orderId: order.id } }), 0);
  const success = await pay(f, randomUUID(), 'SUCCESS', { method: 'BANK_CARD' });
  assert.equal(success.status, 201);
  order = await db.order.findUnique({ where: { id: f.order.id }, include: { payments: true, statusHistory: { orderBy: { createdAt: 'asc' } } } });
  assert.equal(order.status, 'PAID');
  assert.equal(order.payments.length, 2);
  assert.deepEqual(order.statusHistory.map(h => [h.fromStatus, h.toStatus]), [
    ['PENDING', 'PAYMENT_FAILED'], ['PAYMENT_FAILED', 'PENDING'], ['PENDING', 'PAID'],
  ]);
});

test('replaying completed keys returns the same payment and never awards loyalty twice', async () => {
  for (const outcome of ['SUCCESS', 'FAILED']) {
    const f = await fixture();
    const key = randomUUID();
    const first = await pay(f, key, outcome);
    const replay = await pay(f, key, outcome);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.statusCode, 200);
    assert.deepEqual(replay.body.data, first.body.data);
    assert.equal(await db.payment.count({ where: { orderId: f.order.id } }), 1);
    assert.equal(await db.loyaltyTransaction.count({ where: { orderId: f.order.id } }), outcome === 'SUCCESS' ? 1 : 0);
    assert.equal((await db.user.findUnique({ where: { id: f.user.id } })).loyaltyPoints, outcome === 'SUCCESS' ? 65 : 0);
  }
});

test('changed method, demo outcome or order with the same key returns 409', async () => {
  const f = await fixture();
  const key = randomUUID();
  await pay(f, key);
  assert.equal((await pay(f, key, 'SUCCESS', { method: 'BANK_CARD' })).status, 409);
  assert.equal((await pay(f, key, 'FAILED')).status, 409);
  const otherOrder = await db.order.create({ data: { userId: f.user.id, totalAmount: 10000, finalAmount: 10000 } });
  assert.equal((await pay({ ...f, order: otherOrder }, key)).status, 409);
});

test('new keys cannot pay PAID, PREPARING, READY, COMPLETED or CANCELLED orders', async () => {
  for (const status of ['PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']) {
    const f = await fixture(status);
    assert.equal((await pay(f)).status, 409);
    assert.equal(await db.payment.count({ where: { orderId: f.order.id } }), 0);
  }
});

test('concurrent different keys yield exactly one successful payment and one loyalty award', async () => {
  const f = await fixture();
  const results = await Promise.all([pay(f), pay(f)]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  assert.equal(await db.payment.count({ where: { orderId: f.order.id, status: 'SUCCESS' } }), 1);
  assert.equal(await db.loyaltyTransaction.count({ where: { orderId: f.order.id } }), 1);
  assert.equal((await db.user.findUnique({ where: { id: f.user.id } })).loyaltyPoints, 65);
});

test('concurrent identical keys return the same completed transaction', async () => {
  const f = await fixture();
  const key = randomUUID();
  const results = await Promise.all([pay(f, key), pay(f, key)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 201]);
  assert.equal(results[0].body.data.id, results[1].body.data.id);
  assert.equal(await db.payment.count({ where: { orderId: f.order.id } }), 1);
});

test('a global key racing across users/orders never leaks data or pays the losing order', async () => {
  const a = await fixture();
  const b = await fixture();
  const key = randomUUID();
  const results = await Promise.all([pay(a, key), pay(b, key)]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  const loser = results[0].status === 409 ? a : b;
  assert.equal((await db.order.findUnique({ where: { id: loser.order.id } })).status, 'PENDING');
  assert.equal((await db.user.findUnique({ where: { id: loser.user.id } })).loyaltyPoints, 0);
  const denied = await pay(loser, key);
  assert.equal(denied.status, 409);
  assert.equal(denied.body.data, undefined);
});

test('non-owner is denied for a fresh payment and a replay', async () => {
  const f = await fixture();
  const stranger = await fixture();
  assert.equal((await pay(f, randomUUID(), 'SUCCESS', {}, stranger.token)).status, 403);
  const key = randomUUID();
  await pay(f, key);
  const denied = await pay(f, key, 'SUCCESS', {}, stranger.token);
  assert.equal(denied.status, 403);
  assert.equal(denied.body.data, undefined);
});

test('PENDING payment replay and a new key both return an explicit conflict', async () => {
  const f = await fixture();
  const key = randomUUID();
  const first = await pay(f, key, 'FAILED');
  await db.payment.update({ where: { id: first.body.data.id }, data: { status: 'PENDING' } });
  const replay = await pay(f, key, 'FAILED');
  assert.equal(replay.status, 409);
  assert.match(replay.body.message, /in progress/i);
  assert.equal((await pay(f)).status, 409);
  assert.equal(await db.payment.count({ where: { orderId: f.order.id } }), 1);
});

test('transaction failure rolls back payment, retry, paidAt, history and loyalty', async () => {
  const { OrdersService } = require('../src/modules/orders/orders.service');
  const orders = app.get(OrdersService);
  const transition = orders.transition;
  orders.transition = async function (...args) {
    const result = await transition.apply(this, args);
    if (args[1] === 'PAID') throw new Error('Injected failure after loyalty updates');
    return result;
  };
  try {
    for (const status of ['PENDING', 'PAYMENT_FAILED']) {
      const f = await fixture(status);
      assert.equal((await pay(f)).status, 500);
      const order = await db.order.findUnique({ where: { id: f.order.id }, include: { payments: true, statusHistory: true, loyaltyTransactions: true, user: true } });
      assert.equal(order.status, status);
      assert.equal(order.version, 0);
      assert.equal(order.paidAt, null);
      assert.equal(order.pointsEarned, 0);
      assert.equal(order.payments.length, 0);
      assert.equal(order.statusHistory.length, 0);
      assert.equal(order.loyaltyTransactions.length, 0);
      assert.equal(order.user.loyaltyPoints, 0);
    }
  } finally { orders.transition = transition; }
});

test('JWT must be signed, unexpired and have a subject and expiration', async () => {
  const f = await fixture();
  for (const token of ['invalid', '', jwt.sign({ sub: f.user.id }, { expiresIn: -1 }),
    jwt.sign({ sub: f.user.id }), jwt.sign({}, { expiresIn: '1h' }),
    new JwtService({ secret: 'wrong-secret' }).sign({ sub: f.user.id }, { expiresIn: '1h' })]) {
    const denied = await pay(f, randomUUID(), 'SUCCESS', {}, token);
    assert.equal(denied.status, 401);
    assert.equal(denied.body.success, false);
  }
});

test('rejects invalid DTO, client amount, missing key and invalid outcome; missing order is 404', async () => {
  const f = await fixture();
  for (const body of [{ orderId: '' }, { orderId: ' ' }, { method: 'CASH' }, { amount: 1 }, { userId: f.user.id }]) {
    assert.equal((await pay(f, randomUUID(), 'SUCCESS', body)).status, 400);
  }
  assert.equal((await pay(f, '')).status, 400);
  assert.equal((await pay(f, 'x'.repeat(129))).status, 400);
  assert.equal((await pay(f, randomUUID(), 'UNKNOWN')).status, 400);
  assert.equal((await pay(f, randomUUID(), 'SUCCESS', { orderId: 'missing' })).status, 404);
});

test('production, unspecified environment and disabled demo cannot create mock payments', async () => {
  const f = await fixture();
  try {
    for (const [env, enabled] of [['production', 'true'], ['staging', 'true'], ['', 'true'], ['development', 'false']]) {
      process.env.NODE_ENV = env;
      process.env.PAYMENT_DEMO_MODE = enabled;
      assert.equal((await pay(f)).status, 503);
    }
    assert.equal(await db.payment.count({ where: { orderId: f.order.id } }), 0);
    assert.equal((await db.order.findUnique({ where: { id: f.order.id } })).status, 'PENDING');
  } finally {
    process.env.NODE_ENV = 'test';
    process.env.PAYMENT_DEMO_MODE = 'true';
  }
});

test('existing public routes for Payment, Auth, Order and Product remain available', async () => {
  for (const route of ['payments/health', 'auth/health', 'orders/health', 'products']) {
    const response = await fetch(`${base}/api/v1/${route}`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
  }
});

test('conditional Order transition prevents concurrent loyalty awards even without the Payment lock', async () => {
  const { OrdersService } = require('../src/modules/orders/orders.service');
  const f = await fixture();
  const results = await Promise.allSettled([
    app.get(OrdersService).transition(f.order.id, 'PAID'),
    app.get(OrdersService).transition(f.order.id, 'PAID'),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.getStatus(), 409);
  assert.equal(await db.loyaltyTransaction.count({ where: { orderId: f.order.id } }), 1);
  assert.equal((await db.user.findUnique({ where: { id: f.user.id } })).loyaltyPoints, 65);
});

test('replay does not invoke the gateway again; omitted outcome equals explicit SUCCESS', async () => {
  const { MockPaymentGatewayService } = require('../src/modules/payments/mock-payment-gateway.service');
  const f = await fixture('PENDING', 999);
  const key = randomUUID();
  const first = await pay(f, key);
  const gateway = app.get(MockPaymentGatewayService);
  const charge = gateway.charge;
  gateway.charge = () => { throw new Error('Gateway must not be invoked on replay'); };
  try {
    const response = await fetch(`${base}/api/v1/payments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${f.token}`, 'Idempotency-Key': key },
      body: JSON.stringify({ orderId: f.order.id, method: 'E_WALLET' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, first.body.data);
    assert.equal((await db.user.findUnique({ where: { id: f.user.id } })).loyaltyPoints, 0);
  } finally { gateway.charge = charge; }
});

async function fixture(status = 'PENDING', amount = 65999) {
  const user = await db.user.create({ data: { email: `${randomUUID()}@test.local`, passwordHash: 'unused' } });
  const order = await db.order.create({ data: { userId: user.id, status, totalAmount: amount, finalAmount: amount } });
  return { user, order, token: jwt.sign({ sub: user.id }, { expiresIn: '1h' }) };
}

async function pay(f, key = randomUUID(), outcome = 'SUCCESS', body = {}, token = f.token) {
  const response = await fetch(`${base}/api/v1/payments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`,
      'Idempotency-Key': key, 'X-Mock-Outcome': outcome },
    body: JSON.stringify({ orderId: f.order.id, method: 'E_WALLET', ...body }),
  });
  return { status: response.status, body: await response.json() };
}

test('SUCCESS uses server amount, marks PAID, records history and earns floor(amount / 1000)', async () => {
  const f = await fixture();
  const result = await pay(f);
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.statusCode, 201);
  assert.equal(result.body.data.status, 'SUCCESS');
  assert.equal(result.body.data.amount, 65999);
  const order = await db.order.findUnique({ where: { id: f.order.id }, include: { statusHistory: true, loyaltyTransactions: true, user: true } });
  assert.equal(order.status, 'PAID');
  assert.ok(order.paidAt);
  assert.equal(order.pointsEarned, 65);
  assert.equal(order.user.loyaltyPoints, 65);
  assert.equal(order.loyaltyTransactions.length, 1);
  assert.equal(order.statusHistory[0].fromStatus, 'PENDING');
  assert.equal(order.statusHistory[0].toStatus, 'PAID');
});
