import { createContext, useContext, useEffect, useState } from 'react';
import { getProductsFromDatabase } from '../services/apiClient';
import demoProducts from '../data/demoProducts';
import { normalizeCatalogProduct } from '../utils/productOptions';

const ProductCatalogContext = createContext({ products: [], loading: true, error: null, refreshProducts: async () => {} });

export const ProductCatalogProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshProducts = async () => {
    setLoading(true);
    try {
      const catalog = await getProductsFromDatabase();
      setProducts([...demoProducts, ...(Array.isArray(catalog) ? catalog : [])].map(normalizeCatalogProduct));
      setError(null);
    } catch {
      setProducts(demoProducts.map(normalizeCatalogProduct));
      setError('The catalog is temporarily unavailable. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshProducts(); }, []);

  return <ProductCatalogContext.Provider value={{ products, loading, error, refreshProducts }}>{children}</ProductCatalogContext.Provider>;
};

// This hook shares the catalog provider state with product-facing pages.
// eslint-disable-next-line react-refresh/only-export-components
export const useProductCatalog = () => useContext(ProductCatalogContext);
