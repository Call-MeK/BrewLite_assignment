require('dotenv/config');
const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { randomUUID, createHmac } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { ConfigService, ConfigModule } = require('@nestjs/config');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { PaymentsModule } = require('../src/modules/payments/payments.module');
const { PaymentsService } = require('../src/modules/payments/payments.service');
const { ZaloPayService } = require('../src/modules/payments/zalopay.service');
const { PrismaService } = require('../src/prisma/prisma.service');
const { PrismaModule } = require('../src/prisma/prisma.module');
const { PaymentOrderService } = require('../src/modules/payments/payment-order.service');
const { TransformInterceptor } = require('../src/common/interceptors/transform.interceptor');
const { AllExceptionsFilter } = require('../src/common/filters/http-exception.filter');

const schema = `payment_test_${randomUUID().replaceAll('-', '')}`;
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('schema', schema);
const db = new PrismaClient({ datasourceUrl: url.toString() });
const config = new ConfigService({ JWT_SECRET: 'payment-test-secret', ZALOPAY_APP_ID: '123', ZALOPAY_KEY2: 'test-callback-key' });
const protocol = new ZaloPayService(config);
const orders = new PaymentOrderService();
const gateway = {
  assertConfigured() {},
  create: async () => ({ paymentUrl: 'https://qcgateway.zalopay.vn/pay' }),
  query: async () => ({ return_code: 3, is_processing: true }),
  verifyCallback: (...args) => protocol.verifyCallback(...args),
};
let app, base;

before(async () => {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const module = await Test.createTestingModule({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule, PaymentsModule] })
    .overrideProvider(PrismaService).useValue(db)
    .overrideProvider(ConfigService).useValue(config)
    .overrideProvider(ZaloPayService).useValue(gateway).compile();
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
  if (!/^payment_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe test schema');
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
});

async function fixture(status = 'PENDING') {
  const user = await db.user.create({ data: { email: `${randomUUID()}@test.invalid`, passwordHash: 'not-a-password' } });
  const order = await db.order.create({ data: { userId: user.id, status, totalAmount: 65000, finalAmount: 65000 } });
  return { user, order, service: new PaymentsService(db, orders, gateway), key: randomUUID() };
}
const body = order => ({ orderId: order.id, method: 'E_WALLET' });
function callback(payment, changes = {}) {
  const data = JSON.stringify({ app_id: 123, app_trans_id: payment.gatewayOrderId, amount: 65000, zp_trans_id: '261020000001', ...changes });
  return { data, mac: createHmac('sha256', 'test-callback-key').update(data).digest('hex'), type: 1 };
}
const request = async (path, token, data, key) => {
  const response = await fetch(`${base}/api/v1${path}`, {
    method: data ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  return { status: response.status, json: await response.json() };
};

test('creation gets amount from DB and does not pay the order merely by creating a link', async () => {
  const { user, order, service, key } = await fixture();
  const result = await service.create(user.id, body(order), key);
  assert.equal(result.payment.amount, 65000);
  assert.equal(result.payment.status, 'PENDING');
  assert.match(result.payment.gatewayOrderId, /^\d{6}_[a-f0-9]{32}$/);
  assert.ok(result.payment.gatewayOrderId.length <= 40);
  assert.equal((await db.order.findUnique({ where: { id: order.id } })).status, 'PENDING');
  assert.equal(await db.loyaltyTransaction.count({ where: { orderId: order.id } }), 0);
});

test('invalid local gateway configuration is rejected before reserving an attempt', async () => {
  const { user, order, key } = await fixture();
  const invalid = new ZaloPayService(new ConfigService({
    ZALOPAY_APP_ID: '123', ZALOPAY_KEY1: 'test-key', ZALOPAY_KEY2: 'test-key',
    ZALOPAY_REDIRECT_URL: 'http://localhost:3000/payments', ZALOPAY_CALLBACK_URL: 'http://localhost/callback',
  }));
  await assert.rejects(new PaymentsService(db, orders, invalid).create(user.id, body(order), key), e => e.getStatus() === 503);
  assert.equal(await db.payment.count({ where: { orderId: order.id } }), 0);
});

test('same key replays after SUCCESS and loyalty is granted exactly once on duplicate callbacks', async () => {
  const { user, order, service, key } = await fixture();
  const created = await service.create(user.id, body(order), key);
  assert.equal((await service.callback(callback(created.payment))).return_code, 1);
  assert.equal((await service.callback(callback(created.payment))).return_code, 1);
  const replay = await service.create(user.id, body(order), key);
  assert.equal(replay.replayed, true);
  assert.equal(replay.payment.status, 'SUCCESS');
  const savedOrder = await db.order.findUnique({ where: { id: order.id } });
  assert.equal(savedOrder.status, 'PAID');
  assert.equal(savedOrder.pointsEarned, 65);
  assert.ok(savedOrder.paidAt);
  assert.equal((await db.user.findUnique({ where: { id: user.id } })).loyaltyPoints, 65);
  assert.equal(await db.loyaltyTransaction.count({ where: { orderId: order.id } }), 1);
  assert.equal(await db.orderStatusHistory.count({ where: { orderId: order.id, toStatus: 'PAID' } }), 1);
});

test('concurrent same-key requests call create only once; different keys cannot pay an active order', async () => {
  const { user, order, key } = await fixture();
  let count = 0;
  const service = new PaymentsService(db, orders, { ...gateway, create: async () => {
    count++;
    await new Promise(resolve => setTimeout(resolve, 30));
    return { paymentUrl: 'https://qcgateway.zalopay.vn/pay' };
  } });
  const results = await Promise.all([service.create(user.id, body(order), key), service.create(user.id, body(order), key)]);
  assert.equal(count, 1);
  assert.equal(results[0].payment.id, results[1].payment.id);
  assert.equal(await db.payment.count({ where: { orderId: order.id } }), 1);
  await assert.rejects(service.create(user.id, body(order), randomUUID()), e => e.getStatus() === 409);
  await assert.rejects(service.create(user.id, { ...body(order), method: 'BANK_CARD' }, key), e => e.getStatus() === 409);
});

test('concurrent different keys serialize per order and create one gateway transaction', async () => {
  const { user, order, service } = await fixture();
  const results = await Promise.allSettled([
    service.create(user.id, body(order), randomUUID()), service.create(user.id, body(order), randomUUID()),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.getStatus(), 409);
  assert.equal(await db.payment.count({ where: { orderId: order.id } }), 1);
});

test('a global key used concurrently on two orders cannot reserve two payments', async () => {
  const first = await fixture();
  const second = await fixture();
  const results = await Promise.allSettled([
    first.service.create(first.user.id, body(first.order), first.key),
    second.service.create(second.user.id, body(second.order), first.key),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.getStatus(), 409);
  assert.equal(await db.payment.count({ where: { orderId: { in: [first.order.id, second.order.id] } } }), 1);
});

test('missing order, another owner and nonpayable order are rejected without creating a payment', async () => {
  const { user, order, service } = await fixture('CANCELLED');
  await assert.rejects(service.create(user.id, { orderId: 'missing', method: 'E_WALLET' }, randomUUID()), e => e.getStatus() === 404);
  await assert.rejects(service.create('other-user', body(order), randomUUID()), e => e.getStatus() === 403);
  await assert.rejects(service.create(user.id, body(order), randomUUID()), e => e.getStatus() === 409);
  assert.equal(await db.payment.count({ where: { orderId: order.id } }), 0);
});

test('bad signatures, wrong amount or transaction id never mark a payment paid', async () => {
  const { user, order, service, key } = await fixture();
  const { payment } = await service.create(user.id, body(order), key);
  assert.equal((await service.callback({ data: '{}', mac: '0'.repeat(64) })).return_code, -1);
  assert.equal((await service.callback(callback(payment, { amount: 1 }))).return_code, -1);
  assert.equal((await service.callback(callback(payment, { app_trans_id: 'missing' }))).return_code, -1);
  assert.equal((await db.payment.findUnique({ where: { id: payment.id } })).status, 'PENDING');
});

test('timeout keeps PENDING and a retry with another key cannot create another charge', async () => {
  const { user, order, key } = await fixture();
  const service = new PaymentsService(db, orders, { ...gateway, create: async () => { throw new Error('timeout'); } });
  const result = await service.create(user.id, body(order), key);
  assert.equal(result.payment.status, 'PENDING');
  await assert.rejects(service.create(user.id, body(order), randomUUID()), e => e.getStatus() === 409);
  assert.equal((await service.create(user.id, body(order), key)).payment.id, result.payment.id);
});

test('confirmed create rejection fails order and retry records a transition back to PENDING', async () => {
  const { user, order, key } = await fixture();
  const service = new PaymentsService(db, orders, { ...gateway, create: async () => ({ failureReason: 'Rejected' }) });
  assert.equal((await service.create(user.id, body(order), key)).payment.status, 'FAILED');
  assert.equal((await db.order.findUnique({ where: { id: order.id } })).status, 'PAYMENT_FAILED');
  const retry = await new PaymentsService(db, orders, gateway).create(user.id, body(order), randomUUID());
  assert.equal(retry.payment.status, 'PENDING');
  assert.equal(await db.orderStatusHistory.count({ where: { orderId: order.id, fromStatus: 'PAYMENT_FAILED', toStatus: 'PENDING' } }), 1);
});

test('query resolves missed callbacks, validates amount, and expires only confirmed unpaid transactions', async () => {
  const { user, order, service, key } = await fixture();
  const { payment } = await service.create(user.id, body(order), key);
  const resolving = new PaymentsService(db, orders, { ...gateway, query: async () => ({ return_code: 1, is_processing: false, amount: 65000, zp_trans_id: '261020000002' }) });
  assert.equal((await resolving.get(user.id, payment.id)).status, 'SUCCESS');
  const next = await fixture();
  const other = (await next.service.create(next.user.id, body(next.order), next.key)).payment;
  assert.equal((await next.service.get(next.user.id, other.id)).status, 'PENDING');
  const expired = new PaymentsService(db, orders, { ...gateway, query: async () => ({ return_code: 2, sub_return_code: -54, is_processing: false }) });
  assert.equal((await expired.get(next.user.id, other.id)).status, 'FAILED');
});

test('early callback is not overwritten when create finishes', async () => {
  const { user, order, key } = await fixture();
  let service;
  service = new PaymentsService(db, orders, { ...gateway, create: async (payment) => {
    assert.equal((await service.callback(callback(payment))).return_code, 1);
    return { paymentUrl: 'https://qcgateway.zalopay.vn/pay' };
  } });
  assert.equal((await service.create(user.id, body(order), key)).payment.status, 'SUCCESS');
});

test('concurrent callbacks and a successful query settle payment and loyalty once', async () => {
  const { user, order, service, key } = await fixture();
  const { payment } = await service.create(user.id, body(order), key);
  const resolving = new PaymentsService(db, orders, { ...gateway,
    query: async () => ({ return_code: 1, is_processing: false, amount: 65000, zp_trans_id: '261020000001' }),
  });
  const results = await Promise.all([
    service.callback(callback(payment)), service.callback(callback(payment)), resolving.get(user.id, payment.id),
  ]);
  assert.equal(results[0].return_code, 1);
  assert.equal(results[1].return_code, 1);
  assert.equal(results[2].status, 'SUCCESS');
  assert.equal((await db.user.findUnique({ where: { id: user.id } })).loyaltyPoints, 65);
  assert.equal(await db.loyaltyTransaction.count({ where: { orderId: order.id } }), 1);
  assert.equal(await db.orderStatusHistory.count({ where: { orderId: order.id, toStatus: 'PAID' } }), 1);
});

test('not-found and query errors only allow retry inside the confirmed expiry window', async () => {
  for (const [ageMinutes, processing, subcode, expected] of [
    [14, false, -101, 'PENDING'], [16, false, -101, 'FAILED'],
    [48 * 60 + 1, false, -101, 'PENDING'], [16, true, -101, 'PENDING'],
    [16, false, -53, 'PENDING'], [16, false, -500, 'PENDING'],
  ]) {
    const { user, order, service, key } = await fixture();
    const { payment } = await service.create(user.id, body(order), key);
    await db.payment.update({ where: { id: payment.id }, data: { createdAt: new Date(Date.now() - ageMinutes * 60000) } });
    const checking = new PaymentsService(db, orders, { ...gateway,
      query: async () => ({ return_code: 2, sub_return_code: subcode, is_processing: processing }),
    });
    assert.equal((await checking.get(user.id, payment.id)).status, expected, `${ageMinutes}/${processing}/${subcode}`);
  }
});

test('query cannot settle a payment with the wrong amount or expose another owners payment', async () => {
  const { user, order, service, key } = await fixture();
  const { payment } = await service.create(user.id, body(order), key);
  const wrongAmount = new PaymentsService(db, orders, { ...gateway,
    query: async () => ({ return_code: 1, is_processing: false, amount: 1, zp_trans_id: '261020000001' }),
  });
  await assert.rejects(wrongAmount.get(user.id, payment.id), e => e.getStatus() === 400);
  await assert.rejects(service.get('another-user', payment.id), e => e.getStatus() === 403);
  await assert.rejects(service.getOrder('another-user', order.id), e => e.getStatus() === 403);
  assert.equal((await db.payment.findUnique({ where: { id: payment.id } })).status, 'PENDING');
  assert.equal((await db.order.findUnique({ where: { id: order.id } })).status, 'PENDING');
});

test('a database failure rolls back payment success, order history and loyalty together', async () => {
  const { user, order, service, key } = await fixture();
  const { payment } = await service.create(user.id, body(order), key);
  const failing = new PaymentsService(db, { transition: async (...args) => {
    await orders.transition(...args);
    throw new Error('transaction failure');
  } }, gateway);
  assert.equal((await failing.callback(callback(payment))).return_code, 0);
  assert.equal((await db.payment.findUnique({ where: { id: payment.id } })).status, 'PENDING');
  assert.equal((await db.order.findUnique({ where: { id: order.id } })).status, 'PENDING');
  assert.equal((await db.user.findUnique({ where: { id: user.id } })).loyaltyPoints, 0);
  assert.equal(await db.orderStatusHistory.count({ where: { orderId: order.id } }), 0);
});

test('HTTP contract enforces JWT/DTO/header and returns raw callback plus matching 201/200 envelopes', async () => {
  const { user, order, key } = await fixture();
  const token = new JwtService().sign({ sub: user.id }, { secret: 'payment-test-secret', expiresIn: '1h' });
  assert.equal((await request('/payments', null, body(order), key)).status, 401);
  assert.equal((await request('/payments', token, body(order))).status, 400);
  assert.equal((await request('/payments', token, { ...body(order), amount: 1 }, key)).status, 400);
  assert.equal((await request('/payments', token, { orderId: order.id, method: 'cash' }, key)).status, 400);
  const created = await request('/payments', token, body(order), key);
  assert.equal(created.status, 201);
  assert.equal(created.json.statusCode, 201);
  assert.equal(created.json.data.amount, 65000);
  assert.equal(created.json.data.idempotencyKey, undefined);
  const replay = await request('/payments', token, body(order), key);
  assert.equal(replay.status, 200);
  assert.equal(replay.json.statusCode, 200);
  const response = await request('/payments/zalopay/callback', null, callback(created.json.data));
  assert.equal(response.status, 200);
  assert.deepEqual(response.json, { return_code: 1, return_message: 'Success' });
});
