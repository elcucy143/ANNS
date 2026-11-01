import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, CreditCard, LoaderCircle, LockKeyhole, ShieldCheck, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { createRazorpayOrder, getMyOrders, verifyRazorpayPayment } from '../services/apiClient';
import './Checkout.css';
import { trackMetaEvent } from '../utils/metaPixel';
import { calculateCheckoutOffers, FIRST_ORDER_COUPON } from '../utils/storeOffers';

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
  const { cartItems, clearCart, getCartTotal, getShippingTotal, getBogoDiscount, getCartPricing } = useCart();
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState('');
  const [completedOrder, setCompletedOrder] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [firstOrderEligible, setFirstOrderEligible] = useState(null);
  const checkoutTracked = useRef(false);
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
  const offerPricing = calculateCheckoutOffers({
    subtotal: getCartTotal(),
    shippingTotal: getShippingTotal(),
    couponCode,
    firstOrderEligible: firstOrderEligible === true,
  });

  useEffect(() => {
    let active = true;
    getMyOrders()
      .then((orders) => {
        if (!active) return;
        const paidOrders = Array.isArray(orders)
          ? orders.filter((order) => order.paymentStatus === 'captured')
          : [];
        setFirstOrderEligible(paidOrders.length === 0);
      })
      .catch(() => {
        if (active) setFirstOrderEligible(null);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (checkoutTracked.current || !cartItems.length) return;
    checkoutTracked.current = true;
    trackMetaEvent('InitiateCheckout', {
      content_ids: cartItems.map((item) => String(item.id)),
      content_type: 'product',
      contents: cartItems.map((item) => ({ id: String(item.id), quantity: Number(item.quantity), item_price: Number(item.price) })),
      value: offerPricing.total,
      currency: 'INR',
      num_items: cartItems.reduce((total, item) => total + Number(item.quantity), 0),
    });
  }, [cartItems, offerPricing.total]);

  const handlePayment = async (event) => {
    event.preventDefault();
    if (!cartItems.length || isPaying) return;
    setError('');
    setIsPaying(true);
    try {
      await loadRazorpay();
      const checkoutOrder = await createRazorpayOrder({
        customer: {
          id: user?.id || '',
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
        couponCode: couponCode.trim().toUpperCase(),
      });

      trackMetaEvent('AddPaymentInfo', {
        content_ids: cartItems.map((item) => String(item.id)),
        content_type: 'product',
        value: Number(checkoutOrder.amount) / 100,
        currency: checkoutOrder.currency || 'INR',
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
            trackMetaEvent('Purchase', {
              content_ids: cartItems.map((item) => String(item.id)),
              content_type: 'product',
              contents: cartItems.map((item) => ({ id: String(item.id), quantity: Number(item.quantity), item_price: Number(item.price) })),
              value: Number(result.order?.total || checkoutOrder.amount / 100),
              currency: checkoutOrder.currency || 'INR',
              num_items: cartItems.reduce((total, item) => total + Number(item.quantity), 0),
            }, result.order?.id || checkoutOrder.localOrderId);
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
        {completedOrder.deliveryEstimate && (
          <p>Estimated delivery: {new Date(completedOrder.deliveryEstimate.end).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        )}
        <Link to="/" className="checkout-home-link">Continue shopping</Link>
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
          <section>
            <div className="checkout-section-title"><span>3</span><div><h2>Coupon</h2><p>New customers can save 10% on their first paid order.</p></div></div>
            <div className="checkout-coupon-row">
              <label htmlFor="checkout-coupon">Coupon code</label>
              <div>
                <input
                  id="checkout-coupon"
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase().replace(/\s/g, '').slice(0, 40))}
                  placeholder={FIRST_ORDER_COUPON}
                  autoComplete="off"
                />
                <button type="button" onClick={() => setCouponCode(FIRST_ORDER_COUPON)}>Use {FIRST_ORDER_COUPON}</button>
              </div>
              {firstOrderEligible === null && <small>Eligibility is confirmed securely when payment starts.</small>}
              {firstOrderEligible === true && couponCode === FIRST_ORDER_COUPON && <small className="coupon-success">10% first-order discount applied.</small>}
              {firstOrderEligible === false && couponCode === FIRST_ORDER_COUPON && <small className="coupon-warning">FIRST10 is available only on the first paid order.</small>}
            </div>
          </section>
          {error && <div className="checkout-error" role="alert">{error}</div>}
          <button className="pay-now-button" type="submit" disabled={isPaying}>
            {isPaying ? <LoaderCircle className="checkout-spinner" size={19} /> : <LockKeyhole size={18} />}
            {isPaying ? 'Opening secure payment…' : `Pay ₹${offerPricing.total.toLocaleString('en-IN')}`}
          </button>
          <p className="checkout-payment-note"><ShieldCheck size={15} /> Payment details are securely handled by Razorpay and never stored by ANNS.</p>
          <p className="checkout-payment-note"><Truck size={15} /> Estimated delivery is seven days after successful payment. <Link to="/shipping-policy">Shipping</Link> · <Link to="/return-policy">Cancellation and refunds</Link> · <Link to="/contact">Contact/WhatsApp support</Link></p>
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
          <div className="checkout-totals">
            <span>Merchandise<strong>₹{getCartPricing().grossSubtotal.toLocaleString('en-IN')}</strong></span>
            {getBogoDiscount() > 0 && <span>Buy 1 Get 1 savings<strong>− ₹{getBogoDiscount().toLocaleString('en-IN')}</strong></span>}
            {offerPricing.firstOrderDiscount > 0 && <span className="checkout-saving">First order ({FIRST_ORDER_COUPON})<strong>− ₹{offerPricing.firstOrderDiscount.toLocaleString('en-IN')}</strong></span>}
            {offerPricing.cartDiscount > 0 && <span className="checkout-saving">Shop ₹2,999 offer<strong>− ₹{offerPricing.cartDiscount.toLocaleString('en-IN')}</strong></span>}
            <span>Shipping<strong>{offerPricing.freeShippingApplied ? <><s>₹{offerPricing.shippingBeforeOffers.toLocaleString('en-IN')}</s> Free</> : offerPricing.shippingTotal > 0 ? `₹${offerPricing.shippingTotal.toLocaleString('en-IN')}` : 'Free'}</strong></span>
            <span className="grand-total">Total<strong>₹{offerPricing.total.toLocaleString('en-IN')}</strong></span>
          </div>
          <div className="checkout-trust"><ShieldCheck size={19} /><span><strong>Secure online payment</strong><small>UPI, cards, netbanking and supported wallets</small></span></div>
        </aside>
      </div>
    </main>
  );
};

export default Checkout;
