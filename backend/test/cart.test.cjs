const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { Module, ValidationPipe } = require('@nestjs/common');
const { ConfigModule } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { PrismaClient } = require('@prisma/client');

if (!process.env.PAYMENT_TEST_DATABASE_URL) throw new Error('Set PAYMENT_TEST_DATABASE_URL to a disposable PostgreSQL schema');
process.env.DATABASE_URL = process.env.PAYMENT_TEST_DATABASE_URL;
process.env.JWT_SECRET = 'cart-test-only-secret';

const { PrismaModule } = require('../src/prisma/prisma.module');
const { AuthModule } = require('../src/modules/auth/auth.module');
const { CartModule } = require('../src/modules/cart/cart.module');
const { TransformInterceptor } = require('../src/common/interceptors/transform.interceptor');
const { AllExceptionsFilter } = require('../src/common/filters/http-exception.filter');

class CartTestModule {}
Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, CartModule] })(CartTestModule);

const prisma = new PrismaClient();
const marker = randomUUID();
let app, base, owner, other, product, ownerToken, otherToken, cartId, itemId;

before(async () => {
  owner = await prisma.user.create({ data: { email: `${marker}-owner@example.test`, passwordHash: 'test' } });
  other = await prisma.user.create({ data: { email: `${marker}-other@example.test`, passwordHash: 'test' } });
  product = await prisma.product.create({
    data: { name: `Cart test ${marker}`, basePrice: 10000, stock: 10, sizePrices: { create: { size: 'M' } } },
  });
  app = await NestFactory.create(CartTestModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  base = `${await app.getUrl()}/api/v1/cart`;
  const jwt = app.get(JwtService);
  ownerToken = await jwt.signAsync({ sub: owner.id, email: owner.email, ver: 0 });
  otherToken = await jwt.signAsync({ sub: other.id, email: other.email, ver: 0 });
});

after(async () => {
  if (app) await app.close();
  const ids = [owner?.id, other?.id].filter(Boolean);
  const carts = await prisma.cart.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  await prisma.cartItem.deleteMany({ where: { cartId: { in: carts.map((c) => c.id) } } });
  await prisma.cart.deleteMany({ where: { userId: { in: ids } } });
  if (product) await prisma.product.delete({ where: { id: product.id } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

async function request(path, token, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { code: response.status, body: await response.json() };
}

test('cart requires JWT and never reveals or creates another user cart', async () => {
  assert.equal((await request(`/${owner.id}`)).code, 401);
  assert.equal((await request(`/${other.id}`, ownerToken)).code, 403);
  assert.equal(await prisma.cart.count({ where: { userId: other.id } }), 0);
  const own = await request(`/${owner.id}`, ownerToken);
  assert.equal(own.code, 200);
  assert.equal(own.body.data.userId, owner.id);
  assert.equal(own.body.data.success, undefined);
  cartId = own.body.data.id;
});

test('cart rejects foreign writes and malformed items, then allows the owner to edit', async () => {
  assert.equal((await request(`/${other.id}`, otherToken)).code, 200);
  const foreignCart = await prisma.cart.findUnique({ where: { userId: other.id } });
  const item = { cartId, productId: product.id, quantity: 1, size: 'M' };
  assert.equal((await request('/items', otherToken, 'POST', item)).code, 403);
  assert.equal((await request('/items', ownerToken, 'POST', { ...item, quantity: 0 })).code, 400);
  assert.equal((await request('/items', ownerToken, 'POST', { ...item, quantity: 100 })).code, 400);
  assert.equal((await request('/items', ownerToken, 'POST', { ...item, size: 'XL' })).code, 400);
  assert.equal((await request('/items', ownerToken, 'POST', { ...item, size: 'S' })).code, 400);
  assert.equal((await request('/items', ownerToken, 'POST', { ...item, toppingIds: ['missing'] })).code, 400);
  assert.equal((await request('/items', ownerToken, 'POST', { ...item, toppingIds: ['a', 'a'] })).code, 400);
  assert.equal((await request('/items', ownerToken, 'POST', { ...item, cartId: foreignCart.id })).code, 403);
  const added = await request('/items', ownerToken, 'POST', item);
  assert.equal(added.code, 201);
  assert.equal(added.body.data.success, undefined);
  itemId = added.body.data.id;
  assert.equal((await request('/items', ownerToken, 'POST', { ...item, quantity: 2 })).body.data.quantity, 3);
  assert.equal((await request(`/items/${itemId}`, otherToken, 'PATCH', { quantity: 2 })).code, 403);
  assert.equal((await request(`/items/${itemId}`, otherToken, 'DELETE')).code, 403);
  assert.equal((await request(`/${cartId}/clear`, otherToken, 'DELETE')).code, 403);
  for (const field of ['quantity', 'size', 'toppingIds']) {
    assert.equal((await request(`/items/${itemId}`, ownerToken, 'PATCH', { [field]: null })).code, 400);
  }
  assert.equal((await request(`/items/${itemId}`, ownerToken, 'PATCH', { quantity: 2 })).body.data.quantity, 2);
  assert.equal((await request(`/items/${itemId}`, ownerToken, 'DELETE')).code, 200);
  assert.equal(await prisma.cartItem.count({ where: { id: itemId } }), 0);
});

test('add checks the current quantity and variant if another edit overtakes its earlier read', async () => {
  const { CartService } = require('../src/modules/cart/cart.service');
  const tx = {
    $queryRaw: async () => [],
    cartItem: {
      findFirst: async () => ({ id: 'item', quantity: 1 }),
      updateMany: async (args) => {
        assert.deepEqual(args.where, {
          id: 'item', productId: 'product', size: 'M', toppingIds: { equals: [] }, quantity: { lte: 98 },
        });
        return { count: 0 }; // A concurrent edit changed quantity or size.
      },
    },
  };
  const service = new CartService({
    cart: { findUnique: async () => ({ userId: 'owner' }) },
    product: { findUnique: async () => ({ isAvailable: true, stock: 5, sizePrices: [{ id: 'price' }] }) },
    $transaction: async (callback) => callback(tx),
  });
  await assert.rejects(
    service.addItemToCart('owner', { cartId: 'cart', productId: 'product', quantity: 1, size: 'M' }),
    (error) => error.getStatus?.() === 400,
  );
});
