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
    const customPairPrice = first.id === second.id && first.bogoPairPrice > 0 && first.bogoPairPrice === second.bogoPairPrice ? first.bogoPairPrice : 0;
    const pairMrpTotal = first.mrp + second.mrp;
    lines[first.lineIndex].grossLineTotal = (lines[first.lineIndex].grossLineTotal ?? lines[first.lineIndex].price * lines[first.lineIndex].quantity) + (first.mrp - first.price);
    lines[second.lineIndex].grossLineTotal = (lines[second.lineIndex].grossLineTotal ?? lines[second.lineIndex].price * lines[second.lineIndex].quantity) + (second.mrp - second.price);
    let remaining = Math.max(0, pairMrpTotal - Math.min(pairMrpTotal, customPairPrice || Math.max(first.mrp, second.mrp)));
    [second, first].forEach((unit) => {
      const applied = Math.min(lines[unit.lineIndex].grossLineTotal - lines[unit.lineIndex].discount, remaining);
      lines[unit.lineIndex].discount += applied;
      remaining -= applied;
    });
  }
  lines.forEach((line) => { if (line.grossLineTotal === undefined) line.grossLineTotal = line.price * line.quantity; });
  const grossSubtotal = lines.reduce((sum, line) => sum + line.grossLineTotal, 0);
  const bogoDiscount = lines.reduce((sum, line) => sum + line.discount, 0);
  return { grossSubtotal, bogoDiscount, subtotal: grossSubtotal - bogoDiscount, lines, lineDiscounts: lines.map((line) => line.discount) };
};
