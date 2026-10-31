import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useProductCatalog } from './ProductCatalogContext';
import { metaProduct, trackMetaEvent } from '../utils/metaPixel';

const CartContext = createContext();
export const CART_STORAGE_KEY = 'anns-cart-v2';
const LEGACY_CART_STORAGE_KEY = 'cartItems';
const MAX_QUANTITY = 20;

const parsePrice = (value) => {
    const normalized = typeof value === 'string' ? value.replace(/[^0-9.]/g, '') : value;
    const price = Number(normalized);
    return Number.isFinite(price) && price >= 0 ? price : 0;
};

const normalizeQuantity = (value) => Math.min(MAX_QUANTITY, Math.max(1, Math.floor(Number(value) || 1)));

// Persist only checkout fields. Complete products and uploaded base64 images can
// exceed localStorage's small quota and previously caused a blank storefront.
const normalizeCartItem = (item) => {
    if (!item?.id || !item?.name) return null;
    const image = typeof item.image === 'string' && !item.image.startsWith('data:') ? item.image : '';
    return {
        id: String(item.id),
        name: String(item.name),
        price: parsePrice(item.price),
        shippingCharge: parsePrice(item.shippingCharge),
        image,
        quantity: normalizeQuantity(item.quantity),
        size: String(item.size || ''),
        color: String(item.color || ''),
    };
};

const sanitizeCart = (value) => Array.isArray(value) ? value.map(normalizeCartItem).filter(Boolean) : [];

const readStoredCart = () => {
    try {
        const current = localStorage.getItem(CART_STORAGE_KEY);
        const legacy = localStorage.getItem(LEGACY_CART_STORAGE_KEY);
        const cart = sanitizeCart(JSON.parse(current || legacy || '[]'));
        if (legacy) localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
        return cart;
    } catch {
        localStorage.removeItem(CART_STORAGE_KEY);
        localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
        return [];
    }
};

const persistCart = (items) => {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(sanitizeCart(items)));
        localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
    } catch {
        // Private browsing or a full quota must never crash the app. The cart
        // remains usable in memory for the current checkout session.
    }
};

// Provider and hook intentionally share this module.
// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
    const { products } = useProductCatalog();
    const [cartItems, setCartItems] = useState(readStoredCart);

    const [lastAddedItem, setLastAddedItem] = useState(null);
    const [isPopupVisible, setIsPopupVisible] = useState(false);

    useEffect(() => { persistCart(cartItems); }, [cartItems]);

    useEffect(() => {
        if (!products.length) return;
        const catalog = new Map(products.map((product) => [String(product.id), product]));
        // Catalogue changes are an external price update (for example, a flash sale starting or ending).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCartItems((current) => current.map((item) => {
            const product = catalog.get(String(item.id));
            if (!product) return item;
            const nextPrice = parsePrice(product.price);
            const nextImage = typeof product.image === 'string' && !product.image.startsWith('data:') ? product.image : item.image;
            const nextShippingCharge = parsePrice(product.shippingCharge);
            if (item.price === nextPrice && item.shippingCharge === nextShippingCharge && item.name === product.name && item.image === nextImage) return item;
            return { ...item, name: product.name, price: nextPrice, shippingCharge: nextShippingCharge, image: nextImage };
        }));
    }, [products]);

    useEffect(() => {
        const syncCart = (event) => {
            if (event.key !== CART_STORAGE_KEY) return;
            try { setCartItems(sanitizeCart(JSON.parse(event.newValue || '[]'))); } catch { setCartItems([]); }
        };
        window.addEventListener('storage', syncCart);
        return () => window.removeEventListener('storage', syncCart);
    }, []);

    const addToCart = useCallback((product, quantity = 1, size = 'M', color = 'Red') => {
        const addedItem = normalizeCartItem({ ...product, quantity, size, color });
        if (!addedItem) return false;
        setCartItems(prevItems => {
            const existingItemIndex = prevItems.findIndex(
                item => item.id === addedItem.id && item.size === addedItem.size && item.color === addedItem.color
            );
            if (existingItemIndex === -1) return [...prevItems, addedItem];
            return prevItems.map((item, index) => index === existingItemIndex
                ? { ...item, quantity: normalizeQuantity(item.quantity + addedItem.quantity) }
                : item);
        });
        setLastAddedItem(addedItem);
        setIsPopupVisible(true);
        trackMetaEvent('AddToCart', metaProduct(addedItem, addedItem.quantity));
        return true;
    }, []);

    const removeFromCart = (id, size, color) => {
        setCartItems(prevItems =>
            prevItems.filter(item => !(item.id === id && item.size === size && item.color === color))
        );
    };

    const updateQuantity = (id, size, color, newQuantity) => {
        if (newQuantity < 1) return;
        setCartItems(prevItems =>
            prevItems.map(item =>
                item.id === id && item.size === size && item.color === color
                    ? { ...item, quantity: normalizeQuantity(newQuantity) }
                    : item
            )
        );
    };

    const clearCart = () => {
        setCartItems([]);
    };

    const getCartTotal = () => {
        return cartItems.reduce((total, item) => {
            // Remove currency symbol and commas if present, assume price is string like "₹ 1,299"
            return total + parsePrice(item.price) * item.quantity;
        }, 0);
    };

    const getShippingTotal = () => cartItems.reduce(
        (total, item) => total + parsePrice(item.shippingCharge) * item.quantity,
        0,
    );

    const getCartCount = () => {
        return cartItems.reduce((total, item) => total + item.quantity, 0);
    };

    return (
        <CartContext.Provider value={{
            cartItems,
            addToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            getCartTotal,
            getShippingTotal,
            getCartCount,
            lastAddedItem,
            isPopupVisible,
            setIsPopupVisible
        }}>
            {children}
        </CartContext.Provider>
    );
};
