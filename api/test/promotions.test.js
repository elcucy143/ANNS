const test = require('node:test');
const assert = require('node:assert/strict');
const { applyBuyOneGetOne, getBillableUnitPrice } = require('../src/lib/promotions');

test('a single BOGO item retains its Flash Sale price', () => {
  assert.equal(getBillableUnitPrice({ mrp: 1500, sellingPrice: 999, buyOneGetOne: true }), 999);
  assert.equal(getBillableUnitPrice({ mrp: 1500, sellingPrice: 999, buyOneGetOne: false }), 999);
});

test('BOGO uses an optional same-product pair price', () => {
  const result = applyBuyOneGetOne([{ id: 'a', price: 2999, mrp: 5000, bogoPairPrice: 4999, quantity: 2, buyOneGetOne: true }]);
  assert.equal(result.grossSubtotal, 5998);
  assert.equal(result.bogoDiscount, 999);
  assert.equal(result.subtotal, 4999);
});

test('BOGO charges the higher MRP for a mixed pair without exceeding current sale prices', () => {
  const result = applyBuyOneGetOne([{ id: 'a', price: 1200, mrp: 1500, quantity: 1, buyOneGetOne: true }, { id: 'b', price: 900, mrp: 900, quantity: 1, buyOneGetOne: true }]);
  assert.equal(result.grossSubtotal, 2100);
  assert.equal(result.bogoDiscount, 600);
  assert.equal(result.subtotal, 1500);
});

test('one eligible unit is charged at its current selling price', () => {
  const result = applyBuyOneGetOne([{ id: 'a', price: 2999, mrp: 5000, bogoPairPrice: 4999, quantity: 1, buyOneGetOne: true }]);
  assert.equal(result.bogoDiscount, 0);
  assert.equal(result.subtotal, 2999);
});

test('custom pair pricing applies to every pair in a larger quantity', () => {
  const result = applyBuyOneGetOne([{ id: 'a', price: 2999, mrp: 5000, bogoPairPrice: 4999, quantity: 6, buyOneGetOne: true }]);
  assert.equal(result.bogoDiscount, 2997);
  assert.equal(result.subtotal, 14997);
});

test('default BOGO never makes a discounted pair more expensive', () => {
  const result = applyBuyOneGetOne([{ id: 'a', price: 999, mrp: 5000, quantity: 2, buyOneGetOne: true }]);
  assert.equal(result.bogoDiscount, 0);
  assert.equal(result.subtotal, 1998);
});

test('BOGO charges the higher price when eligible prices differ', () => {
  const result = applyBuyOneGetOne([{ id: 'a', price: 1500, mrp: 1500, quantity: 1, buyOneGetOne: true }, { id: 'b', price: 900, mrp: 900, quantity: 1, buyOneGetOne: true }]);
  assert.equal(result.bogoDiscount, 900);
  assert.equal(result.subtotal, 1500);
});

test('BOGO ignores non-eligible products and charges an odd unit normally', () => {
  const result = applyBuyOneGetOne([{ id: 'a', price: 1500, quantity: 1, buyOneGetOne: true }, { id: 'b', price: 1000, quantity: 1, buyOneGetOne: true }, { id: 'c', price: 500, quantity: 1, buyOneGetOne: true }, { id: 'd', price: 250, quantity: 2, buyOneGetOne: false }]);
  assert.equal(result.bogoDiscount, 1000);
  assert.equal(result.subtotal, 2500);
});
