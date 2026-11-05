import { test } from 'node:test';
import assert from 'node:assert/strict';
import { submitCheckoutOrder } from '../src/lib/pending-order.ts';

test('checkout passes the chosen promotion to order creation', async () => {
  const data = new Map([['brewlite-cart', JSON.stringify([{ estimatedUnitPrice: 60000, quantity: 1 }])]]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  let args;
  await submitCheckoutOrder(storage, 'user', async () => null, async () => {}, async (...value) => { args = value; return { id: 'order' }; }, 0, 0, 'GIAM15K');
  assert.equal(args[2], 'GIAM15K');
});
