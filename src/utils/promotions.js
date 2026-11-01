const priceNumber = (value) => {
  const normalized = typeof value === 'string' ? value.replace(/[^0-9.]/g, '') : value;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : 0;
};

export const isBogoEligible = (value) => value === true || ['yes', 'true', '1'].includes(String(value || '').trim().toLowerCase());

export const calculateBogoPricing = (sourceItems = []) => {
  const lines = sourceItems.map((item) => ({ id: String(item.id || ''), price: priceNumber(item.price), mrp: priceNumber(item.mrp || item.price), bogoPairPrice: priceNumber(item.bogoPairPrice), quantity: Math.max(1, Math.trunc(Number(item.quantity) || 1)), eligible: isBogoEligible(item.buyOneGetOne), discount: 0 }));
  const units = [];
  lines.forEach((line, lineIndex) => {
    if (!line.eligible || line.price <= 0) return;
    for (let unit = 0; unit < line.quantity; unit += 1) units.push({ lineIndex, unit, id: line.id, price: line.price, mrp: line.mrp, bogoPairPrice: line.bogoPairPrice });
  });
  units.sort((a, b) => b.mrp - a.mrp || a.lineIndex - b.lineIndex || a.unit - b.unit);
  for (let index = 0; index + 1 < units.length; index += 2) {
    const first = units[index];
    const second = units[index + 1];
    const sellingTotal = first.price + second.price;
    const customPairPrice = first.id === second.id && first.bogoPairPrice > 0 && first.bogoPairPrice === second.bogoPairPrice ? first.bogoPairPrice : 0;
    let remaining = Math.max(0, sellingTotal - Math.min(sellingTotal, customPairPrice || Math.max(first.mrp, second.mrp)));
    [second, first].forEach((unit) => {
      const applied = Math.min((lines[unit.lineIndex].price * lines[unit.lineIndex].quantity) - lines[unit.lineIndex].discount, remaining);
      lines[unit.lineIndex].discount += applied;
      remaining -= applied;
    });
  }
  const grossSubtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const bogoDiscount = lines.reduce((sum, line) => sum + line.discount, 0);
  return { grossSubtotal, bogoDiscount, subtotal: grossSubtotal - bogoDiscount, lineDiscounts: lines.map((line) => line.discount) };
};
