import test from 'node:test';
import assert from 'node:assert/strict';
import { toOrderItems } from '../src/lib/order-payload.ts';

test('order payload includes selection but excludes display prices and names', () => {
  const items = toOrderItems([{
    productId: 'coffee-1', productName: 'Cà phê sữa', imageUrl: null,
    size: 'M', toppingIds: ['topping-1'], toppingNames: ['Trân châu'],
    quantity: 2, estimatedUnitPrice: 35000, currency: 'VND',
  }]);

  assert.deepEqual(items, [{
    productId: 'coffee-1', size: 'M', toppingIds: ['topping-1'], quantity: 2,
  }]);
});
