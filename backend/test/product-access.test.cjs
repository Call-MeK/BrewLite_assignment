require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { GUARDS_METADATA } = require('@nestjs/common/constants');
const { ProductsController } = require('../src/modules/products/products.controller');
const { JwtAuthGuard } = require('../src/modules/auth/jwt-auth.guard');
const { AdminGuard } = require('../src/common/guards/admin.guard');

test('product and recipe mutations require an authenticated administrator', () => {
  for (const method of ['create', 'addRecipeItem', 'removeRecipeItem', 'remove']) {
    assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, ProductsController.prototype[method]), [JwtAuthGuard, AdminGuard]);
  }
});
