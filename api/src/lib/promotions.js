const money = (value) => Number((Number(value) || 0).toFixed(2));

const isBogoEligible = (value) => value === true
  || ['yes', 'true', '1'].includes(String(value || '').trim().toLowerCase());

// A single BOGO-eligible item must retain its current catalogue/Flash Sale
// price. Pair pricing is applied only after two eligible units are present.
const getBillableUnitPrice = ({ sellingPrice }) => money(sellingPrice);

const allocateDiscount = (items, firstUnit, secondUnit, rawDiscount) => {
  let remaining = money(rawDiscount);
  [secondUnit, firstUnit].forEach((unit) => {
    if (remaining <= 0) return;
    const available = money(items[unit.lineIndex].grossLineTotal - items[unit.lineIndex].bogoDiscount);
    const applied = money(Math.min(available, remaining));
    items[unit.lineIndex].bogoDiscount = money(items[unit.lineIndex].bogoDiscount + applied);
    remaining = money(remaining - applied);
  });
};

const applyBuyOneGetOne = (sourceItems = []) => {
  const items = sourceItems.map((item) => {
    const quantity = Math.max(1, Math.trunc(Number(item.quantity) || 1));
    const price = money(item.price);
    const mrp = money(item.mrp || price);
    const bogoPairPrice = money(item.bogoPairPrice);
    return { ...item, quantity, price, mrp, bogoPairPrice, buyOneGetOne: isBogoEligible(item.buyOneGetOne), grossLineTotal: money(price * quantity), bogoDiscount: 0 };
  });
  const eligibleUnits = [];
  items.forEach((item, lineIndex) => {
    if (!item.buyOneGetOne || item.price <= 0) return;
    for (let unit = 0; unit < item.quantity; unit += 1) eligibleUnits.push({ lineIndex, unit, id: String(item.id || ''), price: item.price, mrp: item.mrp, bogoPairPrice: item.bogoPairPrice });
  });
  eligibleUnits.sort((a, b) => b.mrp - a.mrp || a.lineIndex - b.lineIndex || a.unit - b.unit);
  for (let index = 0; index + 1 < eligibleUnits.length; index += 2) {
    const firstUnit = eligibleUnits[index];
    const secondUnit = eligibleUnits[index + 1];
    const pairMrpTotal = money(firstUnit.mrp + secondUnit.mrp);
    const sameProductPairPrice = firstUnit.id === secondUnit.id
      && firstUnit.bogoPairPrice > 0
      && firstUnit.bogoPairPrice === secondUnit.bogoPairPrice
      ? firstUnit.bogoPairPrice
      : 0;
    // A complete BOGO pair is valued from MRP. A configured same-product pair
    // price wins; otherwise the higher-MRP product is charged and the lower is free.
    // Unpaired units continue to use their current catalogue/Flash Sale price.
    items[firstUnit.lineIndex].grossLineTotal = money(items[firstUnit.lineIndex].grossLineTotal + firstUnit.mrp - firstUnit.price);
    items[secondUnit.lineIndex].grossLineTotal = money(items[secondUnit.lineIndex].grossLineTotal + secondUnit.mrp - secondUnit.price);
    const pairCharge = money(Math.min(pairMrpTotal, sameProductPairPrice || Math.max(firstUnit.mrp, secondUnit.mrp)));
    allocateDiscount(items, firstUnit, secondUnit, pairMrpTotal - pairCharge);
  }
  const pricedItems = items.map((item) => ({ ...item, lineTotal: money(item.grossLineTotal - item.bogoDiscount) }));
  const grossSubtotal = money(pricedItems.reduce((sum, item) => sum + item.grossLineTotal, 0));
  const bogoDiscount = money(pricedItems.reduce((sum, item) => sum + item.bogoDiscount, 0));
  return { items: pricedItems, grossSubtotal, bogoDiscount, subtotal: money(grossSubtotal - bogoDiscount), eligibleUnitCount: eligibleUnits.length };
};

module.exports = { applyBuyOneGetOne, getBillableUnitPrice, isBogoEligible };
