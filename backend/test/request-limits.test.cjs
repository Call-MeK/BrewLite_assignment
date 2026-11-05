const assert = require('node:assert/strict');
const { test } = require('node:test');
const { RequestLimitsInterceptor } = require('../src/common/interceptors/request-limits.interceptor');

test('write requests are allowed again after five seconds', () => {
  const limiter = new RequestLimitsInterceptor({ get: () => undefined });
  const originalNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  const headers = {};
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ method: 'POST', socket: { remoteAddress: '127.0.0.1' }, headers: {} }), getResponse: () => ({ setHeader: (key, value) => { headers[key] = value; } }) }),
    getClass: () => ({ name: 'AuthController' }),
    getHandler: () => ({ name: 'login' }),
  };
  try {
    const next = { handle: () => 'ok' };
    assert.equal(limiter.intercept(context, next), 'ok');
    assert.throws(() => limiter.intercept(context, next), { status: 429 });
    assert.equal(headers['Retry-After'], '5');
    now += 5000;
    assert.equal(limiter.intercept(context, next), 'ok');
  } finally {
    Date.now = originalNow;
    limiter.onModuleDestroy();
  }
});
