const assert = require('node:assert/strict');
const { test, mock } = require('node:test');
const { createHmac } = require('node:crypto');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { ZaloPayService } = require('../src/modules/payments/zalopay.service');
const { PaymentAuthGuard } = require('../src/modules/payments/payment-auth.guard');

const config = new ConfigService({
  ZALOPAY_APP_ID: '123', ZALOPAY_KEY1: 'test-create-key',
  ZALOPAY_KEY2: 'test-callback-key', ZALOPAY_REDIRECT_URL: 'http://localhost:3000/payments',
});
const payment = { orderId: 'order-1', gatewayOrderId: '261020_abc', amount: 65000, method: 'E_WALLET' };
const hmac = (key, value) => createHmac('sha256', key).update(value).digest('hex');

test('create signs exact v2 form data and returns a sandbox payment link', async (t) => {
  t.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(url, 'https://sb-openapi.zalopay.vn/v2/create');
    assert.equal(options.method, 'POST');
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('app_id'), '123');
    assert.equal(body.get('app_trans_id'), '261020_abc');
    assert.equal(body.get('amount'), '65000');
    assert.equal(body.get('app_user'), 'user-1');
    assert.equal(body.get('bank_code'), 'zalopayapp');
    assert.equal(body.has('appid'), false);
    const redirect = JSON.parse(body.get('embed_data')).redirecturl;
    assert.equal(redirect, 'http://localhost:3000/payments/order-1');
    const signed = ['app_id', 'app_trans_id', 'app_user', 'amount', 'app_time', 'embed_data', 'item'].map(k => body.get(k)).join('|');
    assert.equal(body.get('mac'), hmac('test-create-key', signed));
    return Response.json({ return_code: 1, return_message: '', order_url: 'https://qcgateway.zalopay.vn/openinapp?order=abc' });
  });
  assert.deepEqual(await new ZaloPayService(config).create(payment, 'user-1'), {
    paymentUrl: 'https://qcgateway.zalopay.vn/openinapp?order=abc',
  });
});

test('bank card method selects the v2 credit card gateway', async (t) => {
  t.mock.method(global, 'fetch', async (_, options) => {
    assert.equal(new URLSearchParams(options.body).get('bank_code'), 'CC');
    return Response.json({ return_code: 1, order_url: 'https://qcgateway.zalopay.vn/pay' });
  });
  await new ZaloPayService(config).create({ ...payment, method: 'BANK_CARD' }, 'user-1');
});

test('query signs the v2 request using app_id|app_trans_id|key1', async (t) => {
  t.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(url, 'https://sb-openapi.zalopay.vn/v2/query');
    const form = new URLSearchParams(options.body);
    assert.equal(form.get('mac'), hmac('test-create-key', '123|261020_abc|test-create-key'));
    return Response.json({ return_code: 1, is_processing: false, amount: 65000, zp_trans_id: 261020000001 });
  });
  assert.deepEqual(await new ZaloPayService(config).query('261020_abc'), {
    return_code: 1, is_processing: false, amount: 65000, zp_trans_id: 261020000001,
  });
});

test('missing configuration is 503 and no network request is made', async (t) => {
  t.mock.method(global, 'fetch', () => assert.fail('must not contact gateway'));
  await assert.rejects(new ZaloPayService(new ConfigService()).create(payment, 'user-1'), e => e.getStatus() === 503);
});

test('network errors, malformed responses and foreign redirect hosts are not accepted', async (t) => {
  const service = new ZaloPayService(config);
  const fetchMock = t.mock.method(global, 'fetch', async () => { throw new DOMException('timeout', 'TimeoutError'); });
  await assert.rejects(service.create(payment, 'user-1'), e => e.getStatus() === 503);
  fetchMock.mock.mockImplementation(async () => Response.json({ returncode: 1 }));
  await assert.rejects(service.query('261020_abc'), e => e.getStatus() === 503);
  fetchMock.mock.mockImplementation(async () => Response.json({ return_code: 1, order_url: 'https://evil.test/pay' }));
  await assert.rejects(service.create(payment, 'user-1'), e => e.getStatus() === 503);
});

test('callback verifies raw data with key2 and rejects bad MAC, app, amount and references', () => {
  const service = new ZaloPayService(config);
  const payload = { app_id: 123, app_trans_id: '261020_abc', amount: 65000, zp_trans_id: 261020000001 };
  const data = JSON.stringify(payload);
  assert.deepEqual(service.verifyCallback(data, hmac('test-callback-key', data)), payload);
  assert.throws(() => service.verifyCallback(data, hmac('test-create-key', data)));
  assert.throws(() => service.verifyCallback(data, 'zz'));
  for (const changed of [{ app_id: 99 }, { amount: 0 }, { zp_trans_id: null }, { app_trans_id: '' }]) {
    const invalid = JSON.stringify({ ...payload, ...changed });
    assert.throws(() => service.verifyCallback(invalid, hmac('test-callback-key', invalid)));
  }
});

test('duplicate and uncertain create responses are kept unresolved, explicit rejection is reported', async (t) => {
  const service = new ZaloPayService(config);
  const fetchMock = t.mock.method(global, 'fetch', async () => Response.json({ return_code: 2, sub_return_code: -68 }));
  await assert.rejects(service.create(payment, 'user-1'), e => e.getStatus() === 503);
  fetchMock.mock.mockImplementation(async () => Response.json({ return_code: 2, sub_return_code: -500 }));
  await assert.rejects(service.create(payment, 'user-1'), e => e.getStatus() === 503);
  fetchMock.mock.mockImplementation(async () => Response.json({ return_code: 2, sub_return_code: -53 }));
  assert.match((await service.create(payment, 'user-1')).failureReason, /-53/);
});

test('JWT guard verifies signatures and expiry and attaches only trusted identity', async () => {
  const jwt = new JwtService({ secret: 'test-jwt-key', signOptions: { algorithm: 'HS256' } });
  const guard = new PaymentAuthGuard(jwt, new ConfigService({ JWT_SECRET: 'test-jwt-key' }));
  const req = { headers: {} };
  const context = { switchToHttp: () => ({ getRequest: () => req }) };
  await assert.rejects(guard.canActivate(context), e => e.getStatus() === 401);
  req.headers.authorization = `Bearer ${jwt.sign({ sub: 'user-1' }, { expiresIn: '1h' })}`;
  assert.equal(await guard.canActivate(context), true);
  assert.equal(req.user.sub, 'user-1');
  req.headers.authorization = `Bearer ${jwt.sign({ sub: 'user-1' }, { expiresIn: -1 })}`;
  await assert.rejects(guard.canActivate(context), e => e.getStatus() === 401);
  req.headers.authorization = `Bearer ${jwt.sign({ sub: 'user-1' }, { secret: 'wrong-key' })}`;
  await assert.rejects(guard.canActivate(context), e => e.getStatus() === 401);
});
