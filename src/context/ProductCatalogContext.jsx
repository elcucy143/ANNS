import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getProductsFromDatabase } from '../services/apiClient';
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
  const [products, setProducts] = useState(readCatalogCache);
  const [loading, setLoading] = useState(true);
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
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProducts();
    const refreshInBackground = () => { void refreshProducts({ background: true }); };
    const interval = window.setInterval(refreshInBackground, 30000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') refreshInBackground(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshProducts]);

  return <ProductCatalogContext.Provider value={{ products, loading, error, refreshProducts }}>{children}</ProductCatalogContext.Provider>;
};

// This hook shares the catalog provider state with product-facing pages.
// eslint-disable-next-line react-refresh/only-export-components
export const useProductCatalog = () => useContext(ProductCatalogContext);
