export const productImageVariant = (url, size = 'listing') => {
  if (typeof url !== 'string' || !url.startsWith('/api/product-image?')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}size=${encodeURIComponent(size)}`;
};

export const productImageSrcSet = (url) => {
  if (typeof url !== 'string' || !url.startsWith('/api/product-image?')) return undefined;
  return [
    `${productImageVariant(url, 'thumbnail')} 320w`,
    `${productImageVariant(url, 'card')} 600w`,
    `${productImageVariant(url, 'listing')} 900w`,
  ].join(', ');
};
