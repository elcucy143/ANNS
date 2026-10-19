export const productImageVariant = (url, size = 'listing') => {
  if (typeof url !== 'string' || !url.startsWith('/api/product-image?')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}size=${encodeURIComponent(size)}`;
};
