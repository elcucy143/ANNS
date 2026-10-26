import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { getMyWishlist, saveMyWishlist } from '../services/apiClient';

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
  const { user, isLoading: authLoading } = useAuth();
  const [wishlistIds, setWishlistIds] = useState(() => readIds(WISHLIST_KEY));
  const [recentIds, setRecentIds] = useState(() => readIds(RECENT_KEY));
  const [wishlistReady, setWishlistReady] = useState(false);
  const customerIdRef = useRef('');

  useEffect(() => {
    if (authLoading) return undefined;
    let active = true;
    customerIdRef.current = user?.id ? `loading:${String(user.id)}` : '';
    queueMicrotask(() => { if (active) setWishlistReady(false); });
    if (!user?.id) {
      queueMicrotask(() => {
        if (!active) return;
        setWishlistIds(readIds(WISHLIST_KEY));
        setWishlistReady(true);
      });
      return () => { active = false; };
    }
    const guestIds = readIds(WISHLIST_KEY);
    getMyWishlist().then(async ({ ids = [] }) => {
      if (!active || customerIdRef.current !== `loading:${String(user.id)}`) return;
      const merged = [...new Set([...guestIds, ...ids.map(String)])].filter(Boolean).slice(0, 100);
      customerIdRef.current = String(user.id);
      setWishlistIds(merged);
      try { localStorage.removeItem(WISHLIST_KEY); } catch { /* optional cleanup */ }
      if (merged.join('|') !== ids.map(String).join('|')) {
        await saveMyWishlist(merged).catch(() => {});
      }
      if (active) setWishlistReady(true);
    }).catch(() => {
      if (!active) return;
      customerIdRef.current = String(user.id);
      setWishlistIds(guestIds);
      setWishlistReady(true);
    });
    return () => { active = false; };
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!wishlistReady) return undefined;
    if (!user?.id) {
      try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlistIds)); } catch { /* optional persistence */ }
      return undefined;
    }
    if (customerIdRef.current !== String(user.id)) return undefined;
    const timer = window.setTimeout(() => { saveMyWishlist(wishlistIds).catch(() => {}); }, 350);
    return () => window.clearTimeout(timer);
  }, [user?.id, wishlistIds, wishlistReady]);
  useEffect(() => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentIds)); } catch { /* optional persistence */ } }, [recentIds]);
  const toggleWishlist = useCallback((id) => setWishlistIds((current) => current.includes(String(id))
    ? current.filter((value) => value !== String(id))
    : [String(id), ...current].slice(0, 100)), []);
  const recordView = useCallback((id) => setRecentIds((current) => [String(id), ...current.filter((value) => value !== String(id))].slice(0, 12)), []);
  return <ShoppingHistoryContext.Provider value={{ wishlistIds, recentIds, wishlistReady, toggleWishlist, recordView }}>{children}</ShoppingHistoryContext.Provider>;
};
