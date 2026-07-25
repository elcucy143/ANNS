import React, { createContext, useState, useEffect, useContext } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
    const [cartItems, setCartItems] = useState(() => {
        const localData = localStorage.getItem('cartItems');
        return localData ? JSON.parse(localData) : [];
    });

    const [lastAddedItem, setLastAddedItem] = useState(null);
    const [isPopupVisible, setIsPopupVisible] = useState(false);

    useEffect(() => {
        localStorage.setItem('cartItems', JSON.stringify(cartItems));
    }, [cartItems]);

    const addToCart = (product, quantity = 1, size = 'M', color = 'Red') => {
        setCartItems(prevItems => {
            const existingItemIndex = prevItems.findIndex(
                item => item.id === product.id && item.size === size && item.color === color
            );

            let newItems;
            if (existingItemIndex > -1) {
                newItems = [...prevItems];
                newItems[existingItemIndex].quantity += quantity;
            } else {
                newItems = [...prevItems, { ...product, quantity, size, color }];
            }

            setLastAddedItem({ ...product, quantity, size, color });
            setIsPopupVisible(true);

            return newItems;
        });
    };

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
                    ? { ...item, quantity: newQuantity }
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
            const priceString = typeof item.price === 'string'
                ? item.price.replace(/[^0-9.]/g, '')
                : item.price;
            const price = parseFloat(priceString);
            return total + (isNaN(price) ? 0 : price * item.quantity);
        }, 0);
    };

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
            getCartCount,
            lastAddedItem,
            isPopupVisible,
            setIsPopupVisible
        }}>
            {children}
        </CartContext.Provider>
    );
};
