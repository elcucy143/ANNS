const FIRST_ORDER_COUPON = 'FIRST10';
const FREE_SHIPPING_MINIMUM = 2000;
const CART_DISCOUNT_MINIMUM = 2999;
const CART_DISCOUNT_AMOUNT = 150;

const money = (value) => Number((Number(value) || 0).toFixed(2));
const price = (value) => Number(String(value ?? '').replace(/[^0-9.]/g, ''));

const validCatalogDiscount = (product) => {
  const mrp = price(product?.price);
  const discount = price(product?.discount);
  return Number.isFinite(mrp) && mrp > 0 && Number.isFinite(discount) && discount > 0 && discount < mrp
    ? Number(discount.toFixed(2))
    : 0;
};

const reconcileFlashSaleItems = (items = [], products = []) => {
  const productsById = new Map(products.map((product) => [String(product.id), product]));
  const reconciled = [];
  const warnings = [];

  for (const item of items) {
    const productId = String(item.productId || '');
    const product = productsById.get(productId);
    if (!product) return { error: `Product ${productId || 'unknown'} was not found`, items: [], warnings };

    const mrp = price(product.price);
    const catalogDiscount = validCatalogDiscount(product);
    const currentCatalogPrice = catalogDiscount || mrp;
    const salePrice = Number(price(item.salePrice).toFixed(2));

    if (item.source === 'catalog') {
      if (!catalogDiscount) {
        warnings.push(`${productId} was removed because it no longer has a catalog discount.`);
        continue;
      }
      if (salePrice !== catalogDiscount) warnings.push(`${productId} was synced to its current catalog discount.`);
      reconciled.push({ ...item, salePrice: catalogDiscount, source: 'catalog' });
      continue;
    }

    if (Number.isFinite(salePrice) && salePrice > 0 && salePrice < currentCatalogPrice) {
      reconciled.push({ ...item, salePrice, source: 'manual' });
      continue;
    }

    // If a product acquired a lower product-level discount after it was added
    // manually, retain it in Flash Sale by switching it to the verified catalog
    // discount. This prevents unrelated banner/title updates from being blocked.
    if (catalogDiscount) {
      warnings.push(`${productId} was synced to its current catalog discount.`);
      reconciled.push({ ...item, salePrice: catalogDiscount, source: 'catalog' });
      continue;
    }

    return {
      error: `Flash Sale price for ${productId} must be lower than its current catalog price`,
      items: [],
      warnings,
    };
  }

  return { items: reconciled, warnings, error: '' };
};

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
  reconcileFlashSaleItems,
  validCatalogDiscount,
};
