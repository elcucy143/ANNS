const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileFlashSaleItems } = require('../src/lib/storeOffers');

test('catalog-synced products may use their current product discount', () => {
  const result = reconcileFlashSaleItems(
    [{ productId: 'ww300001', salePrice: 999, source: 'catalog' }],
    [{ id: 'ww300001', price: 1499, discount: 999 }],
  );
  assert.equal(result.error, '');
  assert.deepEqual(result.items, [{ productId: 'ww300001', salePrice: 999, source: 'catalog' }]);
});

test('an older manual price is safely synced when the catalog discount becomes lower', () => {
  const result = reconcileFlashSaleItems(
    [{ productId: 'ww300001', salePrice: 1199, source: 'manual' }],
    [{ id: 'ww300001', price: 1499, discount: 999 }],
  );
  assert.equal(result.error, '');
  assert.equal(result.items[0].salePrice, 999);
  assert.equal(result.items[0].source, 'catalog');
  assert.equal(result.warnings.length, 1);
});

test('a genuine manual flash price must remain below the current catalog price', () => {
  const valid = reconcileFlashSaleItems(
    [{ productId: 'gift1', salePrice: 699, source: 'manual' }],
    [{ id: 'gift1', price: 999, discount: 799 }],
  );
  assert.equal(valid.error, '');
  assert.equal(valid.items[0].salePrice, 699);

  const invalid = reconcileFlashSaleItems(
    [{ productId: 'gift2', salePrice: 999, source: 'manual' }],
    [{ id: 'gift2', price: 999, discount: '' }],
  );
  assert.match(invalid.error, /must be lower/);
});

test('stale automatic entries are removed instead of blocking banner updates', () => {
  const result = reconcileFlashSaleItems(
    [{ productId: 'gift1', salePrice: 799, source: 'catalog' }],
    [{ id: 'gift1', price: 999, discount: '' }],
  );
  assert.equal(result.error, '');
  assert.deepEqual(result.items, []);
  assert.equal(result.warnings.length, 1);
});
