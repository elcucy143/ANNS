const test = require('node:test');
const assert = require('node:assert/strict');
const { getSizePrice, normalizeSizePrices } = require('../src/lib/sizePricing');

test('gift size prices preserve labels and valid amounts', () => {
  assert.deepEqual(normalizeSizePrices([
    { size: '4×6', price: 499 },
    { size: '8×9', price: '₹799' },
  ]), [
    { size: '4×6', price: 499 },
    { size: '8×9', price: 799 },
  ]);
});

test('gift size lookup is case insensitive and rejects unavailable sizes', () => {
  const product = { sizePrices: [{ size: 'Large', price: 999 }] };
  assert.equal(getSizePrice(product, 'large'), 999);
  assert.equal(getSizePrice(product, 'Small'), 0);
});

test('duplicate gift sizes use the latest price', () => {
  assert.deepEqual(normalizeSizePrices([
    { size: '4×6', price: 499 },
    { size: '4×6', price: 549 },
  ]), [{ size: '4×6', price: 549 }]);
});
