const assert = require('node:assert/strict');
const { test, mock } = require('node:test');
const { Decimal } = require('@prisma/client/runtime/library');
const { METHOD_METADATA, PATH_METADATA } = require('@nestjs/common/constants');
const { ProductsController } = require('../src/modules/products/products.controller');
const { ProductsService } = require('../src/modules/products/products.service');

test('GET /products returns the public menu list', async () => {
  const products = [{ id: 'coffee', name: 'Americano' }];
  const getProducts = mock.fn(async () => products);
  const controller = new ProductsController({ getProducts });

  assert.deepEqual(await controller.findAll(), products);
  assert.equal(getProducts.mock.callCount(), 1);
  assert.equal(Reflect.getMetadata(PATH_METADATA, ProductsController.prototype.findAll), '/');
  assert.equal(Reflect.getMetadata(METHOD_METADATA, ProductsController.prototype.findAll), 0);
});

test('GET /products/:id returns product detail for the requested id', async () => {
  const product = { id: 'coffee', toppings: [] };
  const getProductDetail = mock.fn(async () => product);
  const controller = new ProductsController({ getProductDetail });

  assert.deepEqual(await controller.findOne('coffee'), product);
  assert.deepEqual(getProductDetail.mock.calls[0].arguments, ['coffee']);
  assert.equal(Reflect.getMetadata(PATH_METADATA, ProductsController.prototype.findOne), ':id');
  assert.equal(Reflect.getMetadata(METHOD_METADATA, ProductsController.prototype.findOne), 0);
});

test('getProducts selects the sellable menu and returns only public fields', async () => {
  const findMany = mock.fn(async () => [{
    id: 'coffee',
    name: 'Americano',
    basePrice: new Decimal(40000),
    imageUrl: null,
    isAvailable: true,
    stock: 30,
    version: 1,
    category: { name: 'Cà phê' },
    sizePrices: [{ size: 'M', priceAdjustment: new Decimal(5000) }],
  }]);
  const service = new ProductsService({ product: { findMany } });

  assert.deepEqual(await service.getProducts(), [{
    id: 'coffee',
    name: 'Americano',
    basePrice: 40000,
    imageUrl: null,
    isAvailable: true,
    categoryName: 'Cà phê',
    sizePrices: [{ size: 'M', priceAdjustment: 5000 }],
  }]);
  const query = findMany.mock.calls[0].arguments[0];
  assert.deepEqual(query.where, { isAvailable: true, stock: { gt: 0 } });
  assert.deepEqual(query.orderBy, { name: 'asc' });
  assert.deepEqual(query.include.sizePrices.orderBy, { priceAdjustment: 'asc' });
});

test('getProducts supports products without a category or sizes and an empty menu', async () => {
  const findMany = mock.fn(async () => [{
    id: 'tea', name: 'Tea', basePrice: new Decimal(20000),
    imageUrl: null, isAvailable: true, category: null, sizePrices: [],
  }]);
  const service = new ProductsService({ product: { findMany } });
  const [product] = await service.getProducts();
  assert.equal(product.categoryName, null);
  assert.deepEqual(product.sizePrices, []);
  findMany.mock.mockImplementation(async () => []);
  assert.deepEqual(await service.getProducts(), []);
});

test('getProducts propagates database errors to the global exception filter', async () => {
  const error = new Error('Database unavailable');
  const service = new ProductsService({
    product: { findMany: async () => { throw error; } },
  });
  await assert.rejects(service.getProducts(), error);
});
