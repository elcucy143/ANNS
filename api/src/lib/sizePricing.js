const money = (value) => {
  const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : 0;
};

const normalizeSizePrices = (value) => {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.entries(value).map(([size, price]) => ({ size, price }))
      : [];
  const normalized = new Map();
  entries.forEach((entry) => {
    const size = String(entry?.size ?? entry?.label ?? '').trim().slice(0, 50);
    const price = money(entry?.price);
    if (size && price > 0) normalized.set(size.toUpperCase(), { size, price });
  });
  return [...normalized.values()];
};

const getSizePrice = (product, requestedSize) => {
  const size = String(requestedSize || '').trim().toUpperCase();
  if (!size) return 0;
  return normalizeSizePrices(product?.sizePrices)
    .find((entry) => entry.size.toUpperCase() === size)?.price || 0;
};

module.exports = { getSizePrice, normalizeSizePrices };
