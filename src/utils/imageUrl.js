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

export const mediaImageVariant = (url, variant = 'hero-v1') => {
  if (typeof url !== 'string' || !url.startsWith('/api/media-image?')) return url;
  if (/[?&]variant=/.test(url)) return url;
  return `${url}&variant=${encodeURIComponent(variant)}`;
};

const imageFallback = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><rect width="600" height="800" fill="#f5f1ed"/><text x="300" y="385" text-anchor="middle" font-family="Arial,sans-serif" font-size="52" font-weight="700" fill="#382e28">ANNS</text><text x="300" y="430" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#8a7d74">Product image unavailable</text></svg>');

// A transient mobile-network or stale browser-cache failure should not leave a
// permanent blank card. Retry the immutable URL once with a cache-busting
// query, then show a branded fallback if the source itself is unavailable.
export const recoverProductImage = (event) => {
  const image = event.currentTarget;
  if (image.dataset.retried !== 'true') {
    image.dataset.retried = 'true';
    const source = image.currentSrc || image.src;
    image.removeAttribute('srcset');
    const separator = source.includes('?') ? '&' : '?';
    image.src = `${source}${separator}retry=${Date.now()}`;
    return;
  }
  image.removeAttribute('srcset');
  image.src = imageFallback;
};
