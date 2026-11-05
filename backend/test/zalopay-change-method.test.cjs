const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ServiceUnavailableException } = require('@nestjs/common');
const { ZaloPaySandboxService } = require('../src/modules/payments/zalopay-sandbox.service');

function setup(cancel) {
  const payment = { id: 'p', orderId: 'o', source: 'ZALOPAY_SANDBOX', status: 'PENDING', method: 'E_WALLET', amount: 10000, providerOrderId: 'provider', providerAmount: null, order: { userId: 'u' } };
  let transitioned = false;
  const tx = { $queryRaw: async () => [], payment: { findUnique: async () => payment, update: async ({ data }) => Object.assign(payment, data) }, order: { findUnique: async () => ({ status: 'PENDING' }) } };
  const prisma = { payment: { findUnique: async () => payment }, $transaction: async (fn) => fn(tx) };
  const service = new ZaloPaySandboxService(prisma, { transition: async () => { transitioned = true; } }, { assertReady() {}, cancel }, { isAdmin: async () => false });
  return { service, payment, get transitioned() { return transitioned; } };
}

test('only a confirmed provider cancellation releases the pending payment', async () => {
  const result = setup(async () => true);
  const payment = await result.service.cancel('p', 'u');
  assert.equal(payment.status, 'FAILED');
  assert.equal(result.transitioned, true);
});

test('an unknown provider outcome keeps the existing payment pending', async () => {
  const result = setup(async () => { throw new ServiceUnavailableException(); });
  await assert.rejects(result.service.cancel('p', 'u'), { status: 503 });
  assert.equal(result.payment.status, 'PENDING');
  assert.equal(result.transitioned, false);
});

test('another customer cannot cancel the payment', async () => {
  let called = false;
  const result = setup(async () => { called = true; });
  await assert.rejects(result.service.cancel('p', 'other'), { status: 403 });
  assert.equal(called, false);
  assert.equal(result.payment.status, 'PENDING');
});
