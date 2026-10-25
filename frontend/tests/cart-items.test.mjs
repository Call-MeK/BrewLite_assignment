import test from 'node:test';
import assert from 'node:assert/strict';
import { addOrMergeCartItem, replaceCartItem } from '../src/lib/cart-items.ts';

const coffee = {
  productId: 'coffee', productName: 'Cà phê', imageUrl: null, size: 'M',
  toppingIds: ['milk'], toppingNames: ['Sữa'], quantity: 98,
  estimatedUnitPrice: 35000, currency: 'VND',
};

test('adding the same selection merges quantity without mutating saved items', () => {
  const saved = [{ ...coffee, quantity: 2 }];
  const result = addOrMergeCartItem(saved, { ...coffee, toppingIds: ['milk'], quantity: 3 });
  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 5);
  assert.equal(saved[0].quantity, 2);
});

test('adding past 99 rejects the selection rather than silently dropping drinks', () => {
  assert.throws(() => addOrMergeCartItem([coffee], { ...coffee, quantity: 3 }), /99/);
});

test('different toppings create a separate cart item', () => {
  const result = addOrMergeCartItem([coffee], { ...coffee, toppingIds: [], toppingNames: [], quantity: 1 });
  assert.equal(result.length, 2);
});

test('editing a selection replaces it and merges a matching variant', () => {
  const saved = [
    { ...coffee, size: 'S', quantity: 2 },
    { ...coffee, size: 'M', quantity: 3 },
  ];
  const result = replaceCartItem(saved, 0, { ...coffee, size: 'M', quantity: 4 });
  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 7);
  assert.equal(saved.length, 2);
});

test('editing refuses a missing item or a merged quantity above 99', () => {
  assert.throws(() => replaceCartItem([coffee], 4, { ...coffee, quantity: 1 }), /không còn/);
  assert.throws(() => replaceCartItem([{ ...coffee, quantity: 98 }, { ...coffee, size: 'S' }], 1, { ...coffee, quantity: 2 }), /99/);
});
