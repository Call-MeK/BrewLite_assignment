import test from 'node:test';
import assert from 'node:assert/strict';
import { clearPendingOrder, finishPaidPendingOrder, reconcilePendingOrder, submitCheckoutOrder } from '../src/lib/pending-order.ts';

function storage(values = {}) {
  const data = new Map(Object.entries(values));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

const pending = {
  'brewlite-pending-order-id': 'order-1',
  'brewlite-pending-order-user-id': 'user-1',
  'brewlite-pending-order-cart': '[{"productId":"coffee"}]',
  'brewlite-cart': '[{"productId":"coffee"}]',
};

test('validates ownership and server status before resuming the matching pending order', async () => {
  const store = storage(pending);
  let cancellations = 0;
  const order = await reconcilePendingOrder(store, 'user-1', async () => ({ id: 'order-1', status: 'PAYMENT_FAILED' }), async () => { cancellations++; }, true);
  assert.equal(order.id, 'order-1');
  assert.equal(cancellations, 0);
});

test('cancels a same-user pending order before replacing an edited cart', async () => {
  const store = storage({ ...pending, 'brewlite-cart': '[]' });
  let cancellations = 0;
  const order = await reconcilePendingOrder(store, 'user-1', async () => ({ id: 'order-1', status: 'PENDING' }), async () => { cancellations++; }, true);
  assert.equal(order, null);
  assert.equal(cancellations, 1);
  assert.equal(store.getItem('brewlite-pending-order-id'), null);
  assert.equal(store.getItem('brewlite-cart'), '[]');
});

test('opening checkout with an edited cart preserves the pending order until submit', async () => {
  const store = storage({ ...pending, 'brewlite-cart': '[]' });
  let cancellations = 0;
  const order = await reconcilePendingOrder(store, 'user-1', async () => ({ id: 'order-1', status: 'PENDING' }), async () => { cancellations++; });
  assert.equal(order, null);
  assert.equal(cancellations, 0);
  assert.equal(store.getItem('brewlite-pending-order-id'), 'order-1');
});

test('does not access or cancel a prior account pending order', async () => {
  const store = storage(pending);
  let fetched = false;
  const order = await reconcilePendingOrder(store, 'user-2', async () => { fetched = true; }, async () => assert.fail('must not cancel another user order'));
  assert.equal(order, null);
  assert.equal(fetched, false);
  assert.equal(store.getItem('brewlite-pending-order-id'), null);
});

test('clears cancelled and stale orders instead of resuming them', async () => {
  const cancelled = storage(pending);
  assert.equal(await reconcilePendingOrder(cancelled, 'user-1', async () => ({ id: 'order-1', status: 'CANCELLED' }), async () => assert.fail()), null);
  assert.equal(cancelled.getItem('brewlite-pending-order-id'), null);

  const stale = storage(pending);
  assert.equal(await reconcilePendingOrder(stale, 'user-1', async () => { throw { statusCode: 404 }; }, async () => assert.fail()), null);
  assert.equal(stale.getItem('brewlite-pending-order-id'), null);
});

test('checkout clears the cart after confirming the pending order is already paid', async () => {
  const store = storage(pending);
  assert.equal(await reconcilePendingOrder(store, 'user-1', async () => ({ id: 'order-1', status: 'PAID' }), async () => assert.fail()), null);
  assert.equal(store.getItem('brewlite-cart'), null);
  assert.equal(store.getItem('brewlite-pending-order-id'), null);
});

test('submit re-reads the cart after reconciliation and does not recreate a paid order', async () => {
  const store = storage(pending);
  let created = false;
  const result = await submitCheckoutOrder(
    store,
    'user-1',
    async () => ({ id: 'order-1', status: 'PAID' }),
    async () => assert.fail(),
    async () => { created = true; return { id: 'order-2' }; },
    0,
    500,
  );
  assert.equal(result.type, 'empty');
  assert.equal(created, false);
});

test('paid order clears only its unchanged cart and matching pending metadata', () => {
  const edited = storage({ ...pending, 'brewlite-cart': '[]' });
  assert.equal(finishPaidPendingOrder(edited, 'order-1'), false);
  assert.equal(edited.getItem('brewlite-cart'), '[]');
  assert.equal(edited.getItem('brewlite-pending-order-id'), null);

  const unchanged = storage(pending);
  assert.equal(finishPaidPendingOrder(unchanged, 'order-1'), true);
  assert.equal(unchanged.getItem('brewlite-cart'), null);
});

test('explicit cancellation clears metadata only for the matching order', () => {
  const store = storage(pending);
  assert.equal(clearPendingOrder(store, 'other-order'), false);
  assert.equal(clearPendingOrder(store, 'order-1'), true);
  assert.equal(store.getItem('brewlite-pending-order-id'), null);
});
