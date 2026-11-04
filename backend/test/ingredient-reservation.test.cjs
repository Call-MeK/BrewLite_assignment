const assert = require('node:assert/strict');
const { test } = require('node:test');
const { OrdersService } = require('../src/modules/orders/orders.service');

test('ingredient requirements use the selected size and decimal quantity', async () => {
  const tx = { recipeIngredient: { findMany: async ({ where }) => {
    assert.deepEqual(where, { productId: 'p', size: 'L' });
    return [{ ingredientId: 'i', quantity: { valueOf: () => 1.25 } }];
  } } };
  const result = await new OrdersService({}).calculateRequiredIngredients(tx, [{ productId: 'p', size: 'L', quantity: 2 }]);
  assert.deepEqual(result, [{ ingredientId: 'i', totalQuantity: 2.5 }]);
});

test('cancellation restores the recorded ingredient quantity after recipes change', async () => {
  let restored;
  const tx = {
    order: {
      findFirst: async () => ({ id: 'o', orderNumber: 1, status: 'PENDING', version: 0, items: [], loyaltyTransactions: [], ingredients: [{ ingredientId: 'i', quantity: 2.5 }] }),
      updateMany: async () => ({ count: 1 }),
    },
    ingredient: { updateMany: async (args) => { restored = args; return { count: 1 }; } },
    orderStatusHistory: { create: async () => ({}) },
  };
  await new OrdersService({ $transaction: cb => cb(tx) }).cancel('o', 'u');
  assert.equal(restored.where.id, 'i');
  assert.equal(restored.data.stock.increment, 2.5);
});
