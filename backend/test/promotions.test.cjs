const assert = require('node:assert/strict');
const { test } = require('node:test');
const { OrdersService } = require('../src/modules/orders/orders.service');

test('lists only active promotions within their validity period', async () => {
  let query;
  const service = new OrdersService({ promotion: { findMany: async (args) => { query = args; return []; } } });
  assert.deepEqual(await service.getPromotions(), []);
  assert.equal(query.where.isActive, true);
  assert.ok(query.where.startDate.lte instanceof Date);
  assert.deepEqual(query.where.OR, [{ endDate: null }, { endDate: { gte: query.where.startDate.lte } }]);
});
