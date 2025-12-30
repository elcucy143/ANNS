import React, { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import { ShoppingBag, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import './CartPopup.css';
import images from '../assets/images';

const CartPopup = () => {
    const { isPopupVisible, setIsPopupVisible, lastAddedItem, getCartTotal, cartItems } = useCart();
    const [shouldRender, setShouldRender] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsPopupVisible(false);
            setShouldRender(false);
            setIsClosing(false);
        }, 1000); // Matching the slow close animation duration
    };

    useEffect(() => {
        let timer;
        if (isPopupVisible) {
            setShouldRender(true);
            setIsClosing(false);
            timer = setTimeout(() => {
                handleClose();
            }, 5000);
        }
        return () => clearTimeout(timer);
    }, [isPopupVisible]);

    if (!shouldRender || !lastAddedItem) return null;

    const filename = lastAddedItem.image ? lastAddedItem.image.split('/').pop() : '';

    return (
        <div className={`cart-popup ${isClosing ? 'closing' : 'opening'}`}>
            <div className="cart-popup-header">
                <h3><ShoppingBag size={18} /> Added to Cart</h3>
                <button className="close-popup-btn" onClick={handleClose}>
                    <X size={18} />
                </button>
            </div>

            <div className="cart-popup-content">
                <div className="popup-item-info">
                    <div className="popup-item-img">
                        <img src={images[filename] || lastAddedItem.image} alt={lastAddedItem.name} />
                    </div>
                    <div className="popup-item-details">
                        <h4>{lastAddedItem.name}</h4>
                        <p>Size: {lastAddedItem.size} | Qty: {lastAddedItem.quantity}</p>
                        <p className="popup-item-price">₹{lastAddedItem.price}</p>
                    </div>
                </div>
            </div>

            <div className="cart-popup-footer">
                <div className="popup-cart-summary">
                    <span>Cart Total ({cartItems.length} items):</span>
                    <span className="popup-total-price">₹{getCartTotal().toFixed(2)}</span>
                </div>
                <div className="popup-actions">
                    <Link to="/cart" className="view-cart-btn" onClick={handleClose}>View Cart</Link>
                    <button className="checkout-btn-small" onClick={handleClose}>Checkout</button>
                </div>
            </div>
        </div>
    );
};

export default CartPopup;
