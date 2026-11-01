import React from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Minus, Plus, ArrowLeft } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useProductCatalog } from '../context/ProductCatalogContext';
import { useAuth } from '../context/AuthContext';
import './Cart.css';

import images from '../assets/images';
import { productImageVariant } from '../utils/imageUrl';
import { calculateCheckoutOffers, CART_DISCOUNT_MINIMUM, FREE_SHIPPING_MINIMUM } from '../utils/storeOffers';

const Cart = () => {
    const { cartItems, removeFromCart, updateQuantity, getCartTotal, getShippingTotal, getBogoDiscount, getCartPricing } = useCart();
    const { products } = useProductCatalog();
    const { user, isLoading } = useAuth();
    const cartPricing = getCartPricing();
    const offerPricing = calculateCheckoutOffers({ subtotal: getCartTotal(), shippingTotal: getShippingTotal() });
    const freeShippingRemaining = Math.max(0, FREE_SHIPPING_MINIMUM - getCartTotal());
    const cartDiscountRemaining = Math.max(0, CART_DISCOUNT_MINIMUM - getCartTotal());

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
                    {cartItems.map((item) => {
                        const currentProduct = products.find((product) => String(product.id) === String(item.id));
                        const currentImage = currentProduct?.image || item.image;
                        const filename = currentImage ? currentImage.split('/').pop() : '';
                        return (
                            <div key={`${item.id}-${item.size}-${item.color}`} className="cart-item">
                                <div className="cart-item-image">
                                    {currentImage ? <img src={images[filename] || productImageVariant(currentImage, 'thumbnail')} alt={item.name} /> : <div aria-hidden="true">ANNS</div>}
                                </div>
                                <div className="cart-item-details">
                                    <h3>{item.name}</h3>
                                    <p className="item-variant">Size: {item.size} | Color: {item.color}</p>
                                    <p className="item-price">₹{item.price}</p>
                                    {item.buyOneGetOne && <p className="item-variant"><strong>{Number(item.bogoPairPrice) > 0 ? `BUY 1 GET 1 · 2 for ₹${Number(item.bogoPairPrice).toLocaleString('en-IN')}` : 'BUY 1 GET 1 · applies to each complete pair'}</strong></p>}
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
                        );
                    })}
                </div>

                <div className="cart-summary">
                    <h2>Order Summary</h2>
                    <div className="summary-row"><span>Merchandise</span><span>₹ {cartPricing.grossSubtotal.toFixed(2)}</span></div>
                    {getBogoDiscount() > 0 && <div className="summary-row"><span>Buy 1 Get 1 savings</span><span>− ₹ {getBogoDiscount().toFixed(2)}</span></div>}
                    <div className="summary-row"><span>Subtotal</span><span>₹ {getCartTotal().toFixed(2)}</span></div>
                    {offerPricing.cartDiscount > 0 && <div className="summary-row"><span>Shop ₹2,999 offer</span><span>− ₹ {offerPricing.cartDiscount.toFixed(2)}</span></div>}
                    <div className="summary-row">
                        <span>Shipping</span>
                        <span>{offerPricing.freeShippingApplied ? 'Free' : offerPricing.shippingTotal > 0 ? `₹ ${offerPricing.shippingTotal.toFixed(2)}` : 'Free'}</span>
                    </div>
                    {freeShippingRemaining > 0 && <p className="cart-offer-hint">Add ₹{freeShippingRemaining.toLocaleString('en-IN')} more for free shipping.</p>}
                    {freeShippingRemaining === 0 && cartDiscountRemaining > 0 && <p className="cart-offer-hint">Add ₹{cartDiscountRemaining.toLocaleString('en-IN')} more to save ₹150.</p>}
                    <p className="cart-offer-hint">First order? Use <strong>FIRST10</strong> at checkout for 10% off.</p>
                    <div className="summary-divider"></div>
                    <div className="summary-row total">
                        <span>Total</span>
                        <span>₹ {offerPricing.total.toFixed(2)}</span>
                    </div>
                    <Link
                        to={user ? '/checkout' : '/account'}
                        state={user ? undefined : { from: '/checkout' }}
                        className="checkout-btn"
                        aria-disabled={isLoading}
                    >
                        {isLoading ? 'Checking account…' : user ? 'Proceed to Checkout' : 'Sign in to Checkout'}
                    </Link>
                    <Link to="/" className="continue-link">Continue Shopping</Link>
                </div>
            </div>
        </div>
    );
};

export default Cart;
