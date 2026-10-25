import test from 'node:test';
import assert from 'node:assert/strict';
import { filterMenu } from '../src/lib/menu-filter.ts';

test('category and Vietnamese name search work together', () => {
  const products = [
    { name: 'Trà đào', categoryName: 'Trà & Trái cây' },
    { name: 'Trà sữa', categoryName: 'Trà & Trái cây' },
    { name: 'Cà phê đào', categoryName: 'Cà phê' },
  ];
  assert.deepEqual(filterMenu(products, ' ĐÀO ', 'Trà & Trái cây'), [products[0]]);
  assert.deepEqual(filterMenu(products, '', ''), products);
});
