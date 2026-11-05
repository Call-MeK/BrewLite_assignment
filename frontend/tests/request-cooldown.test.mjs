import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCooldownStore } from '../src/lib/request-cooldown.ts';

test('requests can be repeated after five seconds', () => {
  let now = 1000;
  const store = createCooldownStore(undefined, () => now);
  assert.equal(store.start('login'), true);
  assert.equal(store.remaining('login'), 5);
  now += 4999;
  assert.equal(store.start('login'), false);
  now += 1;
  assert.equal(store.start('login'), true);
});
