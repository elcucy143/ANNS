import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, CreditCard, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { createRazorpayOrder, verifyRazorpayPayment } from '../services/apiClient';
import './Checkout.css';

const loadRazorpay = () => new Promise((resolve, reject) => {
  if (window.Razorpay) return resolve(true);
  const existing = document.getElementById('razorpay-checkout-script');
  if (existing) {
    existing.addEventListener('load', () => resolve(true), { once: true });
    existing.addEventListener('error', () => reject(new Error('Unable to load Razorpay Checkout')), { once: true });
    return;
  }
  const script = document.createElement('script');
  script.id = 'razorpay-checkout-script';
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.onload = () => resolve(true);
  script.onerror = () => reject(new Error('Unable to load Razorpay Checkout'));
  document.body.appendChild(script);
});

const Checkout = () => {
  const { user } = useAuth();
  const { cartItems, clearCart, getCartTotal } = useCart();
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState('');
  const [completedOrder, setCompletedOrder] = useState(null);
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
  });

  const handleChange = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const handlePayment = async (event) => {
    event.preventDefault();
    if (!user || !cartItems.length || isPaying) return;
    setError('');
    setIsPaying(true);
    try {
      await loadRazorpay();
      const checkoutOrder = await createRazorpayOrder({
        customer: {
          id: user.id,
          name: form.name,
          email: form.email,
          phone: form.phone,
        },
        shippingAddress: {
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
        },
        items: cartItems.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
        })),
      });

      const razorpay = new window.Razorpay({
        key: checkoutOrder.keyId,
        amount: checkoutOrder.amount,
        currency: checkoutOrder.currency,
        name: 'ANNS',
        description: `Order ${checkoutOrder.localOrderId}`,
        order_id: checkoutOrder.orderId,
        prefill: {
          name: form.name,
          email: form.email,
          contact: form.phone,
        },
        notes: { order_reference: checkoutOrder.localOrderId },
        theme: { color: '#29231f' },
        modal: {
          confirm_close: true,
          ondismiss: () => setIsPaying(false),
        },
        retry: { enabled: true },
        handler: async (payment) => {
          try {
            const result = await verifyRazorpayPayment(payment);
            setCompletedOrder(result.order);
            clearCart();
          } catch (verificationError) {
            setError(verificationError.message || 'Payment verification failed. Please contact support.');
          } finally {
            setIsPaying(false);
          }
        },
      });
      razorpay.on('payment.failed', (failure) => {
        setError(failure.error?.description || 'Payment failed. Please try again.');
        setIsPaying(false);
      });
      razorpay.open();
    } catch (paymentError) {
      setError(paymentError.message || 'Unable to start payment. Please try again.');
      setIsPaying(false);
    }
  };

  if (completedOrder) {
    return (
      <main className="checkout-result container">
        <CheckCircle2 size={58} />
        <p className="checkout-kicker">PAYMENT CONFIRMED</p>
        <h1>Thank you for your order</h1>
        <p>Your payment was verified and your order is now being prepared.</p>
        <div className="order-reference"><span>Order reference</span><strong>{completedOrder.id}</strong></div>
        <Link to="/" className="checkout-home-link">Continue shopping</Link>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="checkout-signin container">
        <LockKeyhole size={42} />
        <p className="checkout-kicker">SECURE CHECKOUT</p>
        <h1>Sign in before payment</h1>
        <p>Your account connects this purchase to your order history and delivery updates.</p>
        <Link to="/account">Sign in or register</Link>
        <Link to="/cart" className="checkout-back-link"><ChevronLeft size={17} /> Return to cart</Link>
      </main>
    );
  }

  if (!cartItems.length) {
    return (
      <main className="checkout-signin container">
        <CreditCard size={42} />
        <h1>Your cart is empty</h1>
        <p>Add an item before proceeding to payment.</p>
        <Link to="/">Browse products</Link>
      </main>
    );
  }

  return (
    <main className="checkout-page container">
      <Link to="/cart" className="checkout-back-link"><ChevronLeft size={17} /> Return to cart</Link>
      <div className="checkout-heading">
        <div><p className="checkout-kicker">SECURE CHECKOUT</p><h1>Delivery & payment</h1></div>
        <span><ShieldCheck size={18} /> Razorpay protected</span>
      </div>
      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handlePayment}>
          <section>
            <div className="checkout-section-title"><span>1</span><div><h2>Contact information</h2><p>We’ll send confirmation and delivery updates here.</p></div></div>
            <div className="checkout-fields two-column">
              <label>Full name<input name="name" value={form.name} onChange={handleChange} required autoComplete="name" /></label>
              <label>Mobile number<input name="phone" value={form.phone} onChange={handleChange} required inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" /></label>
              <label className="full-width">Email address<input name="email" type="email" value={form.email} onChange={handleChange} required autoComplete="email" /></label>
            </div>
          </section>
          <section>
            <div className="checkout-section-title"><span>2</span><div><h2>Shipping address</h2><p>Enter the address where this order should be delivered.</p></div></div>
            <div className="checkout-fields two-column">
              <label className="full-width">Address<input name="addressLine1" value={form.addressLine1} onChange={handleChange} required autoComplete="address-line1" placeholder="House number, building and street" /></label>
              <label className="full-width">Apartment, landmark (optional)<input name="addressLine2" value={form.addressLine2} onChange={handleChange} autoComplete="address-line2" /></label>
              <label>City<input name="city" value={form.city} onChange={handleChange} required autoComplete="address-level2" /></label>
              <label>State<input name="state" value={form.state} onChange={handleChange} required autoComplete="address-level1" /></label>
              <label>PIN code<input name="postalCode" value={form.postalCode} onChange={handleChange} required inputMode="numeric" pattern="[0-9]{6}" autoComplete="postal-code" /></label>
            </div>
          </section>
          {error && <div className="checkout-error" role="alert">{error}</div>}
          <button className="pay-now-button" type="submit" disabled={isPaying}>
            {isPaying ? <LoaderCircle className="checkout-spinner" size={19} /> : <LockKeyhole size={18} />}
            {isPaying ? 'Opening secure payment…' : `Pay ₹${getCartTotal().toLocaleString('en-IN')}`}
          </button>
          <p className="checkout-payment-note"><ShieldCheck size={15} /> Payment details are securely handled by Razorpay and never stored by ANNS.</p>
        </form>
        <aside className="checkout-summary">
          <p className="checkout-kicker">YOUR ORDER</p>
          <h2>{cartItems.reduce((sum, item) => sum + item.quantity, 0)} items</h2>
          <div className="checkout-items">
            {cartItems.map((item) => (
              <div key={`${item.id}-${item.size}-${item.color}`}>
                <span>{item.quantity} × {item.name}<small>{[item.size, item.color].filter(Boolean).join(' · ')}</small></span>
                <strong>₹{(Number(String(item.price).replace(/[^0-9.]/g, '')) * item.quantity).toLocaleString('en-IN')}</strong>
              </div>
            ))}
          </div>
          <div className="checkout-totals"><span>Shipping<strong>Free</strong></span><span className="grand-total">Total<strong>₹{getCartTotal().toLocaleString('en-IN')}</strong></span></div>
          <div className="checkout-trust"><ShieldCheck size={19} /><span><strong>Secure online payment</strong><small>UPI, cards, netbanking and supported wallets</small></span></div>
        </aside>
      </div>
    </main>
  );
};

export default Checkout;
