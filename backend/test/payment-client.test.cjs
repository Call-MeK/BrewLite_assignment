const assert = require('node:assert/strict');
const { test } = require('node:test');
const { clearPaidCart, getPaymentAttemptKey } = require('../../frontend/src/lib/payments');

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('cart clearing is scoped to a successful payment for the pending order', () => {
  const original = JSON.stringify({ state: { pendingOrderId: 'order-1', items: [{ name: 'Coffee' }], totalAmount: 65000, badgeCount: 1 }, version: 0 });
  const store = storage({ brewlite_cart_storage: original });
  assert.equal(clearPaidCart(store, { orderId: 'order-1', status: 'FAILED' }), false);
  assert.equal(store.getItem('brewlite_cart_storage'), original);
  assert.equal(clearPaidCart(store, { orderId: 'other-order', status: 'SUCCESS' }), false);
  assert.equal(store.getItem('brewlite_cart_storage'), original);
  assert.equal(clearPaidCart(store, { orderId: 'order-1', status: 'SUCCESS' }), true);
  assert.deepEqual(JSON.parse(store.getItem('brewlite_cart_storage')), {
    state: { pendingOrderId: null, items: [], totalAmount: 0, badgeCount: 0 }, version: 0,
  });
});

test('broken or unavailable storage never masks a successful payment', () => {
  const store = storage({ brewlite_cart_storage: 'not-json' });
  assert.equal(clearPaidCart(store, { orderId: 'order-1', status: 'SUCCESS' }), false);
  assert.equal(clearPaidCart({ getItem: () => { throw new Error('blocked'); } }, { orderId: 'order-1', status: 'SUCCESS' }), false);
});

test('network retries preserve the attempt key, explicit retry after failure creates a fresh key', () => {
  const store = storage();
  const first = getPaymentAttemptKey(store, 'order-1', false);
  assert.equal(getPaymentAttemptKey(store, 'order-1', false), first);
  assert.notEqual(getPaymentAttemptKey(store, 'order-1', true), first);
});
