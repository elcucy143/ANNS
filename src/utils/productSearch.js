const SEARCH_SYNONYMS = [
  ['kurti', 'kurtis', 'kurthi', 'kurthis'],
  ['women', 'womens', 'woman', 'ladies', 'lady'],
  ['jewellery', 'jewelry', 'jewel'],
  ['blackbeads', 'blackbead', 'mangalsutra'],
  ['earring', 'earrings', 'earringset'],
  ['necklace', 'necklaces', 'chain', 'chains'],
  ['gift', 'gifts', 'present'],
  ['threepiece', '3piece', 'threepieceset'],
  ['twopiece', '2piece', 'twopieceset'],
];

const SYNONYM_MAP = new Map();
SEARCH_SYNONYMS.forEach((group) => group.forEach((term) => SYNONYM_MAP.set(term, group)));

export const normalizeSearchText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const compact = (value) => normalizeSearchText(value).replaceAll(' ', '');

const editDistance = (first, second) => {
  if (first === second) return 0;
  if (!first.length) return second.length;
  if (!second.length) return first.length;
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let row = 1; row <= first.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= second.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (first[row - 1] === second[column - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[second.length];
};

const productSearchFields = (product) => ({
  id: normalizeSearchText(product.id),
  name: normalizeSearchText(product.name),
  category: normalizeSearchText(product.category),
  subcategory: normalizeSearchText(Array.isArray(product.subcategory) ? product.subcategory.join(' ') : product.subcategory),
  color: normalizeSearchText(product.color),
  sizes: normalizeSearchText(Array.isArray(product.sizes) ? product.sizes.join(' ') : product.sizes),
  description: normalizeSearchText(product.description),
});

const tokenMatches = (queryToken, fieldTokens) => {
  const alternatives = SYNONYM_MAP.get(queryToken) || [queryToken];
  return alternatives.some((alternative) => fieldTokens.some((fieldToken) => {
    if (fieldToken.includes(alternative) || (fieldToken.length >= 3 && alternative.includes(fieldToken))) return true;
    if (alternative.length < 4 || fieldToken.length < 4) return false;
    if (alternative[0] !== fieldToken[0]) return false;
    const tolerance = Math.max(alternative.length, fieldToken.length) >= 6 ? 2 : 1;
    return Math.abs(alternative.length - fieldToken.length) <= tolerance
      && editDistance(alternative, fieldToken) <= tolerance;
  }));
};

export const scoreProductSearch = (product, query) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;
  const fields = productSearchFields(product);
  const allText = Object.values(fields).join(' ');
  const fieldTokens = [...new Set([...allText.split(' ').filter(Boolean), compact(allText)])];
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const compactQuery = compact(query);
  let score = 0;

  if (compact(fields.id) === compactQuery) score += 1000;
  else if (compact(fields.id).includes(compactQuery)) score += 500;
  if (fields.name === normalizedQuery) score += 400;
  else if (fields.name.startsWith(normalizedQuery)) score += 250;
  else if (fields.name.includes(normalizedQuery)) score += 180;
  if (fields.subcategory.includes(normalizedQuery)) score += 110;
  if (fields.category.includes(normalizedQuery)) score += 90;
  if (fields.color.includes(normalizedQuery)) score += 65;

  for (const token of queryTokens) {
    if (!tokenMatches(token, fieldTokens)) return 0;
    if (fields.name.split(' ').includes(token)) score += 55;
    else if (fields.name.includes(token)) score += 40;
    else if (fields.subcategory.includes(token)) score += 28;
    else if (fields.category.includes(token)) score += 24;
    else score += 12;
  }

  if (Number(product.originalPrice) > Number(product.price)) score += 2;
  if (Number(product.stock) > Number(product.sold || 0)) score += 1;
  return score;
};

export const searchProducts = (products, query, limit = Infinity) => products
  .map((product) => ({ product, score: scoreProductSearch(product, query) }))
  .filter((result) => result.score > 0)
  .sort((first, second) => second.score - first.score || String(first.product.name).localeCompare(String(second.product.name)))
  .slice(0, limit)
  .map((result) => result.product);

