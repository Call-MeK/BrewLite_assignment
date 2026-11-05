const assert = require('node:assert/strict');
const { test, mock } = require('node:test');
const { Decimal } = require('@prisma/client/runtime/library');
const { METHOD_METADATA, PATH_METADATA } = require('@nestjs/common/constants');
const { ProductsController } = require('../src/modules/products/products.controller');
const { ProductsService } = require('../src/modules/products/products.service');

test('menu and product details show sold out sizes when ingredients are insufficient', async () => {
  const product = {
    id: 'tea', name: 'Tea', basePrice: new Decimal(20000), imageUrl: null,
    isAvailable: true, stock: 2, category: { name: 'Tea', slug: 'tea' },
    sizePrices: [
      { size: 'S', priceAdjustment: new Decimal(0), recipeItems: [{ quantity: new Decimal(10), ingredient: { stock: 12 } }] },
      { size: 'M', priceAdjustment: new Decimal(0), recipeItems: [{ quantity: new Decimal(20), ingredient: { stock: 12 } }] },
      { size: 'L', priceAdjustment: new Decimal(0), recipeItems: [] },
    ],
  };
  const service = new ProductsService({ product: { findMany: async () => [product], findUnique: async () => product }, topping: { findMany: async () => [] } });
  const [menu] = await service.getProducts();
  assert.equal(menu.isAvailable, true);
  assert.deepEqual(menu.sizePrices.map(s => s.isAvailable), [true, false]);
  assert.deepEqual(menu.sizePrices.map(s => s.availableQuantity), [1, 0]);
  assert.deepEqual(menu.sizePrices.map(s => s.size), ['S', 'M']);
  assert.deepEqual((await service.getProductDetail('tea')).sizePrices.map(s => s.isAvailable), [true, false]);
  assert.deepEqual((await service.getProductDetail('tea')).sizePrices.map(s => s.size), ['S', 'M']);
  product.sizePrices[0].recipeItems[0].ingredient.stock = 0;
  assert.equal((await service.getProducts())[0].isAvailable, false);
  assert.equal((await service.getProductDetail('tea')).isAvailable, false);
});

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
    sizePrices: [{ size: 'M', priceAdjustment: new Decimal(5000), recipeItems: [{ quantity: new Decimal(1), ingredient: { stock: 30 } }] }],
  }]);
  const service = new ProductsService({ product: { findMany } });

  assert.deepEqual(await service.getProducts(), [{
    id: 'coffee',
    name: 'Americano',
    basePrice: 40000,
    imageUrl: null,
    isAvailable: true,
    categoryName: 'Cà phê',
    sizePrices: [{ size: 'M', priceAdjustment: 5000, isAvailable: true, availableQuantity: 30 }],
  }]);
  const query = findMany.mock.calls[0].arguments[0];
  assert.equal(query.where, undefined);
  assert.deepEqual(query.orderBy, { name: 'asc' });
  assert.deepEqual(query.include.sizePrices.orderBy, { priceAdjustment: 'asc' });
});

test('getProducts supports products without a category or sizes and an empty menu', async () => {
  const findMany = mock.fn(async () => [{
    id: 'tea', name: 'Tea', basePrice: new Decimal(20000),
    imageUrl: null, isAvailable: true, stock: 2, category: null, sizePrices: [],
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

test('coffee has size only while other drinks offer the three supported toppings', async () => {
  const findToppings = mock.fn(async () => [
    { id: 'lychee', name: 'Vải', price: new Decimal(8000) },
    { id: 'palm', name: 'Đác thơm', price: new Decimal(8000) },
    { id: 'boba', name: 'Trân châu hoàng kim', price: new Decimal(5000) },
  ]);
  const product = {
    id: 'drink', name: 'Drink', imageUrl: null, basePrice: new Decimal(30000),
    isAvailable: true, stock: 10, sizePrices: [{ size: 'M', priceAdjustment: new Decimal(5000), recipeItems: [{ quantity: new Decimal(1), ingredient: { stock: 30 } }] }],
    category: { slug: 'ca-phe' },
  };
  const service = new ProductsService({
    product: { findUnique: async () => product },
    topping: { findMany: findToppings },
  });
  const coffee = await service.getProductDetail('drink');
  assert.equal(coffee.categorySlug, 'ca-phe');
  assert.deepEqual(coffee.toppings, []);
  assert.equal(findToppings.mock.callCount(), 0);

  product.category.slug = 'tra-trai-cay';
  const tea = await service.getProductDetail('drink');
  assert.deepEqual(tea.toppings.map((item) => item.name), ['Vải', 'Đác thơm', 'Trân châu hoàng kim']);
  assert.deepEqual(findToppings.mock.calls[0].arguments[0].where.name.in, ['Vải', 'Đác thơm', 'Trân châu hoàng kim']);
});
