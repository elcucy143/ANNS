export const FIRST_ORDER_COUPON = 'FIRST10';
export const FREE_SHIPPING_MINIMUM = 2000;
export const CART_DISCOUNT_MINIMUM = 2999;
export const CART_DISCOUNT_AMOUNT = 150;

export const calculateCheckoutOffers = ({ subtotal, shippingTotal, couponCode = '', firstOrderEligible = false }) => {
  const merchandiseSubtotal = Math.max(0, Number(subtotal) || 0);
  const shippingBeforeOffers = Math.max(0, Number(shippingTotal) || 0);
  const couponApplied = couponCode.trim().toUpperCase() === FIRST_ORDER_COUPON && firstOrderEligible;
  const firstOrderDiscount = couponApplied ? Number((merchandiseSubtotal * .10).toFixed(2)) : 0;
  const cartDiscount = merchandiseSubtotal >= CART_DISCOUNT_MINIMUM ? CART_DISCOUNT_AMOUNT : 0;
  const freeShippingApplied = merchandiseSubtotal >= FREE_SHIPPING_MINIMUM;
  const finalShipping = freeShippingApplied ? 0 : shippingBeforeOffers;
  return {
    couponApplied,
    firstOrderDiscount,
    cartDiscount,
    freeShippingApplied,
    shippingBeforeOffers,
    shippingDiscount: freeShippingApplied ? shippingBeforeOffers : 0,
    shippingTotal: finalShipping,
    total: Number((Math.max(0, merchandiseSubtotal - firstOrderDiscount - cartDiscount) + finalShipping).toFixed(2)),
  };
};
