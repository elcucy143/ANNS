export const STANDARD_CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];

const CANONICAL_SIZE = {
  XXXL: '3XL',
  XXXXL: '4XL',
};

const sizeTokenPattern = /4XL|XXXXL|3XL|XXXL|XXL|XL|XS|S|M|L/gi;

export const normalizeList = (value) => {
  if (Array.isArray(value)) return value.flatMap(normalizeList);
  if (value === undefined || value === null || value === '') return [];
  const text = String(value).trim();
  if (text.startsWith('data:image/')) return [text];
  return text.split(/[,|;\n]/).map((item) => item.trim()).filter(Boolean);
};

export const normalizeSizeList = (value) => {
  const values = normalizeList(value).flatMap((item) => {
    // Older entries may contain a value such as "MLXLXXLXXXL". Recover each size
    // instead of exposing that malformed value to customers.
    const matches = item.match(sizeTokenPattern);
    return matches?.length ? matches : [item];
  });

  const unique = [...new Set(values.map((size) => {
    const normalized = String(size).trim().toUpperCase();
    return CANONICAL_SIZE[normalized] || normalized;
  }).filter(Boolean))];

  return unique.sort((first, second) => {
    const firstIndex = STANDARD_CLOTHING_SIZES.indexOf(first);
    const secondIndex = STANDARD_CLOTHING_SIZES.indexOf(second);
    if (firstIndex === -1 && secondIndex === -1) return first.localeCompare(second);
    if (firstIndex === -1) return 1;
    if (secondIndex === -1) return -1;
    return firstIndex - secondIndex;
  });
};

export const normalizeCatalogProduct = (product) => ({
  ...product,
  sizes: normalizeSizeList(product?.sizes),
  otherImages: normalizeList(product?.otherImages),
  subcategory: normalizeList(product?.subcategory),
  stock: Math.max(0, Number(product?.stock) || 0),
  sold: Math.max(0, Number(product?.sold) || 0),
});
