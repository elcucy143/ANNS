const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateCheckoutOffers } = require('../src/lib/storeOffers');

test('FIRST10 gives ten percent only to a first order', () => {
  assert.equal(calculateCheckoutOffers({ subtotal: 1000, shippingTotal: 80, couponCode: 'first10', firstOrderEligible: true }).total, 980);
  assert.equal(calculateCheckoutOffers({ subtotal: 1000, shippingTotal: 80, couponCode: 'FIRST10', firstOrderEligible: false }).total, 1080);
});

test('orders from ₹2000 receive free shipping', () => {
  const result = calculateCheckoutOffers({ subtotal: 2000, shippingTotal: 160 });
  assert.equal(result.freeShippingApplied, true);
  assert.equal(result.shippingTotal, 0);
  assert.equal(result.total, 2000);
});

test('orders from ₹2999 receive ₹150 off and can stack with first order coupon', () => {
  const result = calculateCheckoutOffers({ subtotal: 2999, shippingTotal: 160, couponCode: 'FIRST10', firstOrderEligible: true });
  assert.equal(result.firstOrderDiscount, 299.9);
  assert.equal(result.cartDiscount, 150);
  assert.equal(result.shippingTotal, 0);
  assert.equal(result.total, 2549.1);
});
