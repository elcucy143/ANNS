import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ShoppingHistoryContext = createContext(null);
const WISHLIST_KEY = 'anns-wishlist-v1';
const RECENT_KEY = 'anns-recent-products-v1';
const readIds = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, 30) : [];
  } catch { return []; }
};

// eslint-disable-next-line react-refresh/only-export-components
export const useShoppingHistory = () => useContext(ShoppingHistoryContext);

export const ShoppingHistoryProvider = ({ children }) => {
  const [wishlistIds, setWishlistIds] = useState(() => readIds(WISHLIST_KEY));
  const [recentIds, setRecentIds] = useState(() => readIds(RECENT_KEY));
  useEffect(() => { try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlistIds)); } catch { /* optional persistence */ } }, [wishlistIds]);
  useEffect(() => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentIds)); } catch { /* optional persistence */ } }, [recentIds]);
  const toggleWishlist = useCallback((id) => setWishlistIds((current) => current.includes(String(id))
    ? current.filter((value) => value !== String(id))
    : [String(id), ...current].slice(0, 30)), []);
  const recordView = useCallback((id) => setRecentIds((current) => [String(id), ...current.filter((value) => value !== String(id))].slice(0, 12)), []);
  return <ShoppingHistoryContext.Provider value={{ wishlistIds, recentIds, toggleWishlist, recordView }}>{children}</ShoppingHistoryContext.Provider>;
};
