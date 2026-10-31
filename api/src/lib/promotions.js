const money = (value) => Number((Number(value) || 0).toFixed(2));

const isBogoEligible = (value) => value === true
  || ['yes', 'true', '1'].includes(String(value || '').trim().toLowerCase());

const applyBuyOneGetOne = (sourceItems = []) => {
  const items = sourceItems.map((item) => {
    const quantity = Math.max(1, Math.trunc(Number(item.quantity) || 1));
    const price = money(item.price);
    return { ...item, quantity, price, buyOneGetOne: isBogoEligible(item.buyOneGetOne), grossLineTotal: money(price * quantity), bogoDiscount: 0 };
  });
  const eligibleUnits = [];
  items.forEach((item, lineIndex) => {
    if (!item.buyOneGetOne || item.price <= 0) return;
    for (let unit = 0; unit < item.quantity; unit += 1) eligibleUnits.push({ lineIndex, unit, price: item.price });
  });
  eligibleUnits.sort((a, b) => b.price - a.price || a.lineIndex - b.lineIndex || a.unit - b.unit);
  for (let index = 1; index < eligibleUnits.length; index += 2) {
    const freeUnit = eligibleUnits[index];
    items[freeUnit.lineIndex].bogoDiscount = money(items[freeUnit.lineIndex].bogoDiscount + freeUnit.price);
  }
  const pricedItems = items.map((item) => ({ ...item, lineTotal: money(item.grossLineTotal - item.bogoDiscount) }));
  const grossSubtotal = money(pricedItems.reduce((sum, item) => sum + item.grossLineTotal, 0));
  const bogoDiscount = money(pricedItems.reduce((sum, item) => sum + item.bogoDiscount, 0));
  return { items: pricedItems, grossSubtotal, bogoDiscount, subtotal: money(grossSubtotal - bogoDiscount), eligibleUnitCount: eligibleUnits.length };
};

module.exports = { applyBuyOneGetOne, isBogoEligible };
