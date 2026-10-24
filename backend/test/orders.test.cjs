const assert = require('node:assert/strict');
const { test, mock } = require('node:test');
const { OrderStatus, ProductSize } = require('@prisma/client');
const { NotFoundException } = require('@nestjs/common');
const { OrdersService } = require('../src/modules/orders/orders.service');
const { assertOrderTransition } = require('../src/modules/orders/order-state');

test('order state machine rejects transitions out of terminal states', () => {
  assert.throws(
    () => assertOrderTransition(OrderStatus.COMPLETED, OrderStatus.PAID),
    (error) => error.getStatus() === 409,
  );
  assert.doesNotThrow(() =>
    assertOrderTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED),
  );
});

test('create calculates prices on the server and reserves product and topping stock', async () => {
  let createOrderArgs;
  const tx = {
    product: {
      findMany: async () => [{
        id: 'product-1',
        name: 'Americano',
        basePrice: 40000,
        stock: 5,
        version: 2,
        isAvailable: true,
        sizePrices: [{ size: ProductSize.M, priceAdjustment: 5000 }],
      }],
      updateMany: mock.fn(async () => ({ count: 1 })),
    },
    topping: {
      findMany: async () => [{
        id: 'topping-1',
        name: 'Cheese',
        price: 10000,
        stock: 5,
        isAvailable: true,
      }],
      updateMany: mock.fn(async () => ({ count: 1 })),
    },
    order: {
      create: async (args) => {
        createOrderArgs = args;
        return {
          id: 'order-1',
          orderNumber: 1,
          userId: 'user-1',
          status: OrderStatus.PENDING,
          totalAmount: 110000,
          discountAmount: 0,
          finalAmount: 110000,
          items: [{
            productId: 'product-1',
            size: ProductSize.M,
            quantity: 2,
            unitPrice: 45000,
            lineTotal: 110000,
            toppings: [{ toppingId: 'topping-1', price: 10000 }],
          }],
          statusHistory: [{
            fromStatus: null,
            toStatus: OrderStatus.PENDING,
            changedBy: 'system',
            reason: 'Order created',
          }],
        };
      },
    },
  };
  const prisma = {
    $transaction: (callback) => callback(tx),
  };
  const service = new OrdersService(prisma);

  const order = await service.create('user-1', {
    items: [{
      productId: 'product-1',
      size: ProductSize.M,
      quantity: 2,
      toppingIds: ['topping-1'],
    }],
  });

  assert.equal(order.totalAmount, 110000);
  assert.equal(order.finalAmount, 110000);
  assert.equal(createOrderArgs.data.userId, 'user-1');
  assert.equal(createOrderArgs.data.status, OrderStatus.PENDING);
  assert.equal(createOrderArgs.data.items.create[0].unitPrice, 45000);
  assert.equal(createOrderArgs.data.items.create[0].lineTotal, 110000);
  assert.equal(createOrderArgs.data.statusHistory.create.fromStatus, null);
  assert.equal(tx.product.updateMany.mock.calls[0].arguments[0].where.stock.gte, 2);
  assert.equal(tx.topping.updateMany.mock.calls[0].arguments[0].where.stock.gte, 2);
});

test('history scopes every query to the authenticated user and returns pagination metadata', async () => {
  const order = {
    id: 'order-1',
    orderNumber: 10,
    status: OrderStatus.PAID,
    totalAmount: 60000,
    discountAmount: 5000,
    finalAmount: 55000,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    items: [{ quantity: 2 }, { quantity: 1 }],
  };
  const findMany = mock.fn(async () => [order]);
  const count = mock.fn(async () => 21);
  const service = new OrdersService({
    $transaction: (operations) => Promise.all(operations),
    order: { findMany, count },
  });

  const history = await service.getOrderHistory('user-1', {
    page: 1,
    limit: 20,
  });

  assert.equal(findMany.mock.calls[0].arguments[0].where.userId, 'user-1');
  assert.equal(count.mock.calls[0].arguments[0].where.userId, 'user-1');
  assert.equal(history.items[0].itemCount, 3);
  assert.deepEqual(history.pagination, {
    page: 1,
    limit: 20,
    total: 21,
    totalPages: 2,
    hasNextPage: true,
  });
});

test('order detail hides orders that do not belong to the authenticated user', async () => {
  const service = new OrdersService({
    order: { findFirst: async () => null },
  });

  await assert.rejects(
    service.getOrderDetail('other-user-order', 'user-1'),
    NotFoundException,
  );
});
