const test = require('node:test');
const assert = require('node:assert/strict');
const { applyBuyOneGetOne, getBillableUnitPrice } = require('../src/lib/promotions');

test('BOGO uses MRP instead of stacking a Flash Sale price', () => {
  assert.equal(getBillableUnitPrice({ mrp: 1500, sellingPrice: 999, buyOneGetOne: true }), 1500);
  assert.equal(getBillableUnitPrice({ mrp: 1500, sellingPrice: 999, buyOneGetOne: false }), 999);
});

test('BOGO charges once for two equal-priced eligible units', () => {
  const result = applyBuyOneGetOne([{ id: 'a', price: 1500, quantity: 2, buyOneGetOne: true }]);
  assert.equal(result.grossSubtotal, 3000);
  assert.equal(result.bogoDiscount, 1500);
  assert.equal(result.subtotal, 1500);
});

test('BOGO charges the higher price when eligible prices differ', () => {
  const result = applyBuyOneGetOne([{ id: 'a', price: 1500, quantity: 1, buyOneGetOne: true }, { id: 'b', price: 900, quantity: 1, buyOneGetOne: true }]);
  assert.equal(result.bogoDiscount, 900);
  assert.equal(result.subtotal, 1500);
});

test('BOGO ignores non-eligible products and charges an odd unit normally', () => {
  const result = applyBuyOneGetOne([{ id: 'a', price: 1500, quantity: 1, buyOneGetOne: true }, { id: 'b', price: 1000, quantity: 1, buyOneGetOne: true }, { id: 'c', price: 500, quantity: 1, buyOneGetOne: true }, { id: 'd', price: 250, quantity: 2, buyOneGetOne: false }]);
  assert.equal(result.bogoDiscount, 1000);
  assert.equal(result.subtotal, 2500);
});
