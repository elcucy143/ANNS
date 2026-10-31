const priceNumber = (value) => {
  const normalized = typeof value === 'string' ? value.replace(/[^0-9.]/g, '') : value;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : 0;
};

export const isBogoEligible = (value) => value === true || ['yes', 'true', '1'].includes(String(value || '').trim().toLowerCase());

export const calculateBogoPricing = (sourceItems = []) => {
  const lines = sourceItems.map((item) => ({ price: priceNumber(item.price), quantity: Math.max(1, Math.trunc(Number(item.quantity) || 1)), eligible: isBogoEligible(item.buyOneGetOne), discount: 0 }));
  const units = [];
  lines.forEach((line, lineIndex) => {
    if (!line.eligible || line.price <= 0) return;
    for (let unit = 0; unit < line.quantity; unit += 1) units.push({ lineIndex, unit, price: line.price });
  });
  units.sort((a, b) => b.price - a.price || a.lineIndex - b.lineIndex || a.unit - b.unit);
  for (let index = 1; index < units.length; index += 2) lines[units[index].lineIndex].discount += units[index].price;
  const grossSubtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const bogoDiscount = lines.reduce((sum, line) => sum + line.discount, 0);
  return { grossSubtotal, bogoDiscount, subtotal: grossSubtotal - bogoDiscount, lineDiscounts: lines.map((line) => line.discount) };
};
