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

const SUBCATEGORY_ALIASES = new Map([
  ['kurti', 'Kurtis'],
  ['kurtis', 'Kurtis'],
  ['kurthi', 'Kurtis'],
  ['kurthis', 'Kurtis'],
  ['three piece set', 'Kurtis'],
  ['two piece set', 'Two piece sets'],
  ['two piece sets', 'Two piece sets'],
  ['2 piece set', 'Two piece sets'],
  ['2 piece sets', 'Two piece sets'],
  ['two piece kurti', 'Two piece sets'],
  ['two piece kurtis', 'Two piece sets'],
  ['three piece sets', 'Kurtis'],
  ['three piece kurti', 'Kurtis'],
  ['three piece kurtis', 'Kurtis'],
  ['three piece kurthi', 'Kurtis'],
  ['three piece kurthis', 'Kurtis'],
  ['3 piece kurti', 'Kurtis'],
  ['3 piece kurtis', 'Kurtis'],
  ['3 piece kurthi', 'Kurtis'],
  ['3 piece kurthis', 'Kurtis'],
]);

export const displaySubcategoryLabel = (subcategory) => {
  const normalized = String(subcategory || '').trim().toLowerCase();
  if (normalized === 'kurtis') return '3 Piece Kurtis';
  if (normalized === 'one piece kurtis' || normalized === 'one piece kurti') return 'Kurtis';
  if (normalized === 'two piece sets' || normalized === 'two piece set') return 'Two Piece Sets';
  return String(subcategory || '').trim();
};

export const normalizeSubcategoryList = (value) => [...new Set(normalizeList(value).map((subcategory) => (
  SUBCATEGORY_ALIASES.get(String(subcategory).trim().toLowerCase()) || String(subcategory).trim()
)).filter(Boolean))];

// Use one comparison key everywhere products are imported and filtered. This
// prevents harmless differences such as "Black Beads Sets", "black-beads sets"
// or extra spaces from hiding a product from its storefront subcategory.
export const subcategoryMatchKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '');

export const normalizeCatalogProduct = (product) => ({
  ...product,
  sizes: normalizeSizeList(product?.sizes),
  otherImages: normalizeList(product?.otherImages),
  subcategory: normalizeSubcategoryList(product?.subcategory),
  similarProducts: [...new Set(normalizeList(product?.similarProducts))],
  stock: Math.max(0, Number(product?.stock) || 0),
  sold: Math.max(0, Number(product?.sold) || 0),
});
