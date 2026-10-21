import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getFlashSale, getProductsFromDatabase } from '../services/apiClient';
import { normalizeCatalogProduct } from '../utils/productOptions';

const ProductCatalogContext = createContext({ products: [], loading: true, error: null, refreshProducts: async () => {} });
const CATALOG_CACHE_KEY = 'anns-catalog-cache-v1';
const readCatalogCache = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeCatalogProduct) : [];
  } catch {
    localStorage.removeItem(CATALOG_CACHE_KEY);
    return [];
  }
};

export const ProductCatalogProvider = ({ children }) => {
  const [initialCatalog] = useState(readCatalogCache);
  const [products, setProducts] = useState(initialCatalog);
  const [flashSale, setFlashSale] = useState(null);
  const [loading, setLoading] = useState(initialCatalog.length === 0);
  const [error, setError] = useState(null);

  const refreshProducts = useCallback(async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    try {
      const catalog = await getProductsFromDatabase();
      const normalized = (Array.isArray(catalog) ? catalog : []).map(normalizeCatalogProduct);
      setProducts(normalized);
      try { localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(normalized)); } catch { /* Catalog remains available in memory. */ }
      setError(null);
    } catch {
      const cached = readCatalogCache();
      if (cached.length) {
        setProducts((current) => current.length ? current : cached);
        setError(null);
      } else {
        setError('The catalog is temporarily unavailable. Please try again shortly.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshFlashSale = useCallback(async () => {
    try {
      setFlashSale(await getFlashSale() || null);
    } catch {
      // Keep the last verified sale during a temporary network failure.
    }
  }, []);

  useEffect(() => {
    // Render the last verified catalog immediately and refresh it without
    // replacing the page with a loading screen. First-time visitors still see
    // the loading state until their initial catalog arrives.
    void refreshProducts({ background: initialCatalog.length > 0 });
    void refreshFlashSale();
    const refreshInBackground = () => {
      void refreshProducts({ background: true });
      void refreshFlashSale();
    };
    const interval = window.setInterval(refreshInBackground, 30000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') refreshInBackground(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshProducts, refreshFlashSale, initialCatalog.length]);

  const pricedProducts = useMemo(() => {
    const salePrices = new Map((flashSale?.items || []).map((item) => [String(item.productId), Number(item.salePrice)]));
    return products.map((product) => {
      const regularPrice = Number(String(product.price ?? '').replace(/[^0-9.]/g, ''));
      if (!Number.isFinite(regularPrice) || regularPrice <= 0) return product;
      const uploadedDiscountPrice = Number(String(product.discount ?? '').replace(/[^0-9.]/g, ''));
      const hasUploadedDiscount = Number.isFinite(uploadedDiscountPrice) && uploadedDiscountPrice > 0 && uploadedDiscountPrice < regularPrice;
      const catalogPrice = hasUploadedDiscount ? uploadedDiscountPrice : regularPrice;
      const configuredFlashPrice = salePrices.get(String(product.id));
      const hasFlashDiscount = Number.isFinite(configuredFlashPrice) && configuredFlashPrice > 0 && configuredFlashPrice < catalogPrice;
      const effectivePrice = hasFlashDiscount ? configuredFlashPrice : catalogPrice;
      if (effectivePrice >= regularPrice) return product;
      return {
        ...product,
        regularPrice,
        originalPrice: regularPrice,
        price: effectivePrice,
        discountPercent: Math.round((1 - effectivePrice / regularPrice) * 100),
        flashSale: hasFlashDiscount,
        discounted: true,
      };
    });
  }, [products, flashSale]);

  return <ProductCatalogContext.Provider value={{ products: pricedProducts, loading, error, refreshProducts, flashSale }}>{children}</ProductCatalogContext.Provider>;
};

// This hook shares the catalog provider state with product-facing pages.
// eslint-disable-next-line react-refresh/only-export-components
export const useProductCatalog = () => useContext(ProductCatalogContext);
