const FIRST_ORDER_COUPON = 'FIRST10';
const FREE_SHIPPING_MINIMUM = 2000;
const CART_DISCOUNT_MINIMUM = 2999;
const CART_DISCOUNT_AMOUNT = 150;

const money = (value) => Number((Number(value) || 0).toFixed(2));

const calculateCheckoutOffers = ({ subtotal, shippingTotal, couponCode, firstOrderEligible }) => {
  const merchandiseSubtotal = Math.max(0, money(subtotal));
  const shippingBeforeOffers = Math.max(0, money(shippingTotal));
  const normalizedCoupon = String(couponCode || '').trim().toUpperCase();
  const couponApplied = normalizedCoupon === FIRST_ORDER_COUPON && firstOrderEligible === true;
  const firstOrderDiscount = couponApplied ? money(merchandiseSubtotal * 0.10) : 0;
  const cartDiscount = merchandiseSubtotal >= CART_DISCOUNT_MINIMUM ? CART_DISCOUNT_AMOUNT : 0;
  const merchandiseDiscount = Math.min(merchandiseSubtotal, money(firstOrderDiscount + cartDiscount));
  const freeShippingApplied = merchandiseSubtotal >= FREE_SHIPPING_MINIMUM;
  const shippingDiscount = freeShippingApplied ? shippingBeforeOffers : 0;
  const finalShipping = money(shippingBeforeOffers - shippingDiscount);
  return {
    couponCode: couponApplied ? FIRST_ORDER_COUPON : '',
    couponApplied,
    firstOrderDiscount,
    cartDiscount,
    freeShippingApplied,
    shippingBeforeOffers,
    shippingDiscount,
    shippingTotal: finalShipping,
    total: money(merchandiseSubtotal - merchandiseDiscount + finalShipping),
  };
};

module.exports = {
  CART_DISCOUNT_AMOUNT,
  CART_DISCOUNT_MINIMUM,
  FIRST_ORDER_COUPON,
  FREE_SHIPPING_MINIMUM,
  calculateCheckoutOffers,
};
