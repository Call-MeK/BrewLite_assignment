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

test('create redeems 20 points for 2000 VND using an atomic balance check', async () => {
  const updatePoints = mock.fn(async () => ({ count: 1 }));
  const spent = mock.fn(async () => ({}));
  const createOrder = mock.fn(async ({ data }) => ({
    ...data, id: 'order-1', orderNumber: 1, userId: 'user-1',
    items: [], statusHistory: [],
  }));
  const tx = {
    product: {
      findMany: async () => [{ id: 'coffee', name: 'Coffee', basePrice: 30000, version: 1, sizePrices: [{ size: ProductSize.M, priceAdjustment: 0 }] }],
      updateMany: async () => ({ count: 1 }),
    },
    user: { updateMany: updatePoints },
    loyaltyTransaction: { create: spent },
    order: { create: createOrder },
  };
  const service = new OrdersService({ $transaction: (callback) => callback(tx) });
  const order = await service.create('user-1', { items: [{ productId: 'coffee', quantity: 1 }], pointsToUse: 20 });

  assert.equal(createOrder.mock.calls[0].arguments[0].data.totalAmount, 30000);
  assert.equal(createOrder.mock.calls[0].arguments[0].data.finalAmount, 28000);
  assert.deepEqual(updatePoints.mock.calls[0].arguments[0], {
    where: { id: 'user-1', loyaltyPoints: { gte: 20 } },
    data: { loyaltyPoints: { decrement: 20 } },
  });
  assert.equal(spent.mock.calls[0].arguments[0].data.type, 'SPENT');
  assert.equal(spent.mock.calls[0].arguments[0].data.points, 20);
  assert.equal(order.pointsRedeemed, 20);
  assert.equal(order.pointsDiscountAmount, 2000);
});

test('create rejects invalid or unaffordable point redemption', async () => {
  const tx = {
    product: {
      findMany: async () => [{ id: 'coffee', name: 'Coffee', basePrice: 1000, version: 1, sizePrices: [{ size: ProductSize.M, priceAdjustment: 0 }] }],
      updateMany: async () => ({ count: 1 }),
    },
    user: { updateMany: mock.fn(async () => ({ count: 0 })) },
    order: { create: mock.fn(async () => ({})) },
  };
  const service = new OrdersService({ $transaction: (callback) => callback(tx) });
  const items = [{ productId: 'coffee', quantity: 1 }];
  await assert.rejects(service.create('user-1', { items, pointsToUse: 15 }), { status: 400 });
  await assert.rejects(service.create('user-1', { items, pointsToUse: 20 }), { status: 400 });
  await assert.rejects(service.create('user-1', { items, pointsToUse: 10 }), { status: 400 });
  assert.equal(tx.order.create.mock.callCount(), 0);
});

test('create rejects toppings on coffee even when the topping exists', async () => {
  const createOrder = mock.fn(async () => ({}));
  const tx = {
    product: { findMany: async () => [{
      id: 'coffee', name: 'Coffee', basePrice: 30000, stock: 10, version: 1,
      category: { slug: 'ca-phe' }, sizePrices: [{ size: ProductSize.M, priceAdjustment: 0 }],
    }] },
    topping: { findMany: async () => [{ id: 'lychee', name: 'Vải', price: 8000, stock: 10 }] },
    order: { create: createOrder },
  };
  const service = new OrdersService({ $transaction: (callback) => callback(tx) });
  await assert.rejects(service.create('user-1', { items: [{ productId: 'coffee', quantity: 1, toppingIds: ['lychee'] }] }), { status: 400 });
  assert.equal(createOrder.mock.callCount(), 0);
});

test('cancel refunds redeemed points once with the order transition', async () => {
  const restorePoints = mock.fn(async () => ({}));
  const refunded = mock.fn(async () => ({}));
  const tx = {
    order: {
      findFirst: async () => ({ id: 'order-1', orderNumber: 1, status: OrderStatus.PENDING, version: 0, items: [], loyaltyTransactions: [{ points: 20 }] }),
      updateMany: async () => ({ count: 1 }),
    },
    user: { update: restorePoints },
    loyaltyTransaction: { create: refunded },
    orderStatusHistory: { create: async () => ({}) },
  };
  const service = new OrdersService({ $transaction: (callback) => callback(tx) });
  await service.cancel('order-1', 'user-1');
  assert.deepEqual(restorePoints.mock.calls[0].arguments[0].data, { loyaltyPoints: { increment: 20 } });
  assert.equal(refunded.mock.calls[0].arguments[0].data.type, 'REFUNDED');
  assert.equal(refunded.mock.calls[0].arguments[0].data.points, 20);
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

test('order detail reports redeemed points separately from promotion discount', async () => {
  const service = new OrdersService({
    order: { findFirst: async () => ({
      id: 'order-1', orderNumber: 1, status: OrderStatus.PENDING,
      totalAmount: 30000, discountAmount: 3000, finalAmount: 25000,
      createdAt: new Date(), items: [], loyaltyTransactions: [{ points: 20 }],
    }) },
  });

  const order = await service.getOrderDetail('order-1', 'user-1');
  assert.equal(order.discountAmount, 3000);
  assert.equal(order.pointsRedeemed, 20);
  assert.equal(order.pointsDiscountAmount, 2000);
  assert.equal(order.finalAmount, 25000);
});
