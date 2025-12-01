import React from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Minus, Plus, ArrowLeft } from 'lucide-react';
import { useCart } from '../context/CartContext';
import './Cart.css';

const Cart = () => {
    const { cartItems, removeFromCart, updateQuantity, getCartTotal, clearCart } = useCart();

    if (cartItems.length === 0) {
        return (
            <div className="cart-empty container">
                <h2>Your Cart is Empty</h2>
                <p>Looks like you haven't added anything to your cart yet.</p>
                <Link to="/" className="continue-shopping-btn">
                    <ArrowLeft size={20} /> Continue Shopping
                </Link>
            </div>
        );
    }

    return (
        <div className="cart-page container">
            <h1 className="cart-title">Shopping Cart ({cartItems.length} items)</h1>

            <div className="cart-grid">
                <div className="cart-items">
                    {cartItems.map((item) => (
                        <div key={`${item.id}-${item.size}-${item.color}`} className="cart-item">
                            <div className="cart-item-image">
                                <img src={item.image} alt={item.name} />
                            </div>
                            <div className="cart-item-details">
                                <h3>{item.name}</h3>
                                <p className="item-variant">Size: {item.size} | Color: {item.color}</p>
                                <p className="item-price">{item.price}</p>
                            </div>
                            <div className="cart-item-actions">
                                <div className="quantity-selector small">
                                    <button onClick={() => updateQuantity(item.id, item.size, item.color, item.quantity - 1)}>
                                        <Minus size={16} />
                                    </button>
                                    <span>{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.id, item.size, item.color, item.quantity + 1)}>
                                        <Plus size={16} />
                                    </button>
                                </div>
                                <button
                                    className="remove-btn"
                                    onClick={() => removeFromCart(item.id, item.size, item.color)}
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="cart-summary">
                    <h2>Order Summary</h2>
                    <div className="summary-row">
                        <span>Subtotal</span>
                        <span>₹ {getCartTotal().toFixed(2)}</span>
                    </div>
                    <div className="summary-row">
                        <span>Shipping</span>
                        <span>Free</span>
                    </div>
                    <div className="summary-divider"></div>
                    <div className="summary-row total">
                        <span>Total</span>
                        <span>₹ {getCartTotal().toFixed(2)}</span>
                    </div>
                    <button className="checkout-btn">Proceed to Checkout</button>
                    <Link to="/" className="continue-link">Continue Shopping</Link>
                </div>
            </div>
        </div>
    );
};

export default Cart;
