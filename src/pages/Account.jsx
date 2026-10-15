import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Download, LogOut, Package, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GOOGLE_CLIENT_ID, GOOGLE_IDENTITY_SCRIPT_ID } from '../config/auth';
import { getMyOrders, requestOrderCancellation, requestPasswordReset, resetPassword } from '../services/apiClient';
import './Account.css';

const Account = () => {
  const { user, registerWithAccount, signInWithCredentials, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [accountError, setAccountError] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState('');
  const [notice, setNotice] = useState('');
  const googleButtonRef = useRef(null);
  const resetToken = new URLSearchParams(location.search).get('reset') || '';

  useEffect(() => {
    if (!user) return;
    getMyOrders().then(setOrders).catch((error) => setOrdersError(error.message));
  }, [user]);

  const continueAfterLogin = useCallback(() => {
    navigate(location.state?.from || '/', { replace: true });
  }, [location.state, navigate]);

  useEffect(() => {
    if (user) return undefined;

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        ux_mode: 'popup',
        auto_select: false,
        callback: async ({ credential }) => {
          try {
            setGoogleError('');
            await signInWithGoogle(credential);
            continueAfterLogin();
          } catch (error) {
            setGoogleError(error.message || 'Google sign-in failed. Please try again.');
          }
        },
      });
      googleButtonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        logo_alignment: 'left',
        width: Math.min(420, googleButtonRef.current.clientWidth || 420),
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return undefined;
    }

    const script = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID);
    script?.addEventListener('load', renderGoogleButton, { once: true });
    const handleScriptError = () => setGoogleError('Google sign-in could not be loaded. Please check your connection.');
    script?.addEventListener('error', handleScriptError, { once: true });
    return () => {
      script?.removeEventListener('load', renderGoogleButton);
      script?.removeEventListener('error', handleScriptError);
    };
  }, [continueAfterLogin, signInWithGoogle, user]);

  const handleAccountSubmit = async (event) => {
    event.preventDefault();
    setAccountError('');
    setAccountBusy(true);
    try {
      if (mode === 'register') {
        await registerWithAccount({
          name: form.name,
          phone: form.phone.replace(/\s+/g, ''),
          email: form.email,
          password: form.password,
        });
      } else {
        await signInWithCredentials(form.email, form.password);
      }
      continueAfterLogin();
    } catch (error) {
      setAccountError(error.message || 'Unable to continue. Please try again.');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleFormChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleForgotPassword = async () => {
    setAccountError('');
    if (!form.email) return setAccountError('Enter your email address first.');
    setAccountBusy(true);
    try { const result = await requestPasswordReset(form.email); setNotice(result.message); } catch (error) { setAccountError(error.message); }
    finally { setAccountBusy(false); }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault(); setAccountError(''); setAccountBusy(true);
    try { await resetPassword(resetToken, form.password); setNotice('Password updated. You can now sign in.'); navigate('/account', { replace: true }); }
    catch (error) { setAccountError(error.message); } finally { setAccountBusy(false); }
  };

  const cancelOrder = async (order) => {
    const reason = window.prompt('Why would you like to cancel this order?');
    if (!reason) return;
    try {
      const result = await requestOrderCancellation(order.id, reason);
      setOrders((current) => current.map((item) => item.id === order.id ? result.order : item));
    } catch (error) { setOrdersError(error.message); }
  };

  const printInvoice = (order) => {
    const escapeInvoice = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
    const popup = window.open('', '_blank');
    if (!popup) return setOrdersError('Allow pop-ups to download or print the invoice.');
    popup.opener = null;
    const rows = (order.items || []).map((item) => `<tr><td>${escapeInvoice(item.name)}</td><td>${Number(item.quantity) || 0}</td><td>₹${Number(item.lineTotal).toFixed(2)}</td></tr>`).join('');
    popup.document.write(`<!doctype html><title>ANNS Invoice ${escapeInvoice(order.id)}</title><style>body{font:14px Arial;max-width:760px;margin:40px auto;color:#29231f}h1{font-family:Georgia}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}.total{text-align:right;font-size:20px}</style><h1>ANNS Order Invoice</h1><p><strong>Invoice / Order:</strong> ${escapeInvoice(order.id)}<br><strong>Paid:</strong> ${new Date(order.paidAt).toLocaleDateString('en-IN')}<br><strong>Payment ID:</strong> ${escapeInvoice(order.razorpayPaymentId)}</p><p><strong>Bill to:</strong> ${escapeInvoice(order.customer.name)}<br>${escapeInvoice(order.customer.email)}<br>${escapeInvoice(order.customer.phone || '')}</p><table><thead><tr><th>Item</th><th>Quantity</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><p class="total"><strong>Total ₹${Number(order.total).toFixed(2)}</strong></p><p>A.S. Trends & Gifts<br>#36 Sri Sai Anjaneya Nilayam, Jesus Krupa, Block 3, Kodichikknahalli, Bengaluru, Karnataka 560076</p><script>window.print()</script>`);
    popup.document.close();
  };

  if (user) {
    return (
      <section className="account-page account-dashboard-page">
        <div className="account-dashboard">
          <div className="account-success-icon"><Check size={30} /></div>
          <p className="account-eyebrow">MY ACCOUNT</p>
          <h1>Welcome, {user.name}</h1>
          <p className="account-welcome">You’re securely signed in and ready to continue shopping with ANNS.</p>
          <div className="account-profile-card">
            <UserRound size={24} />
            <div><span>Account details</span><strong>{user.email || user.phone}</strong></div>
          </div>
          <div className="account-orders">
            <h2><Package size={22} /> My Orders</h2>
            {orders.map((order) => {
              const cancellable = !['shipped', 'delivered'].includes(order.fulfillmentStatus) && !order.cancellation?.status && !order.refundStatus;
              return <article key={order.id} className="account-order-card">
                <div><strong>{order.id}</strong><span>{new Date(order.paidAt || order.createdAt).toLocaleDateString('en-IN')} · ₹{Number(order.total).toLocaleString('en-IN')}</span></div>
                <p>Status: <strong>{order.status || order.fulfillmentStatus || 'Processing'}</strong></p>
                {order.deliveryEstimate?.end && <p>Estimated delivery: {new Date(order.deliveryEstimate.start).toLocaleDateString('en-IN')} – {new Date(order.deliveryEstimate.end).toLocaleDateString('en-IN')}</p>}
                {order.trackingNumber && <p>Tracking: <strong>{order.courier || 'Courier'} · {order.trackingNumber}</strong></p>}
                {order.trackingUrl
                  ? <a href={order.trackingUrl} target="_blank" rel="noreferrer">Track shipment with {order.courier || 'courier'}</a>
                  : ['processing', 'packed'].includes(order.fulfillmentStatus || 'processing') && <p>Your tracking link will appear here after dispatch.</p>}
                <div className="account-order-actions"><button type="button" onClick={() => printInvoice(order)}><Download size={15} /> Invoice</button>{cancellable && <button type="button" className="danger" onClick={() => cancelOrder(order)}><XCircle size={15} /> Request cancellation</button>}</div>
              </article>;
            })}
            {!orders.length && !ordersError && <p>No paid orders yet.</p>}
            {ordersError && <p className="account-error">{ordersError}</p>}
          </div>
          <a href="/" className="account-primary-link">Continue shopping</a>
          <button type="button" className="account-signout" onClick={signOut}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </section>
    );
  }

  if (resetToken) {
    return <section className="account-page"><div className="account-panel"><div className="account-form-wrap"><div className="account-heading"><p className="account-eyebrow">ANNS ACCOUNT</p><h2>Choose a new password</h2></div><form className="account-form" onSubmit={handleResetPassword}><label>New password<input name="password" type="password" value={form.password} onChange={handleFormChange} required minLength={10} maxLength={128} autoComplete="new-password" /></label><p className="password-guidance">Use 10–128 characters with a letter and number.</p>{accountError && <p className="account-error">{accountError}</p>}<button className="account-submit" disabled={accountBusy}>{accountBusy ? 'Updating…' : 'Update password'}</button></form></div></div></section>;
  }

  return (
    <section className="account-page">
      <div className="account-shell">
        <aside className="account-story">
          <a href="/" className="account-back"><ArrowLeft size={17} /> Back to ANNS</a>
          <div className="account-story-content">
            <p className="account-eyebrow">THE ANNS EXPERIENCE</p>
            <h1>Style, saved<br />just for you.</h1>
            <p>Sign in for quicker checkout, order updates and a shopping experience made personal.</p>
          </div>
          <div className="account-trust"><ShieldCheck size={20} /> Your information stays private and secure.</div>
        </aside>

        <div className="account-panel">
          <div className="account-form-wrap">
            <div className="account-heading">
              <p className="account-eyebrow">WELCOME TO ANNS</p>
              <h2>{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</h2>
              <p>Use your ANNS account or continue securely with Google.</p>
            </div>
            <div className="account-tabs" role="tablist" aria-label="Account action">
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setAccountError(''); }}>Sign in</button>
              <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setAccountError(''); }}>Register</button>
            </div>
            <form className="account-form" onSubmit={handleAccountSubmit}>
              {mode === 'register' && (
                <>
                  <label>Full name<input name="name" value={form.name} onChange={handleFormChange} required autoComplete="name" /></label>
                  <label>Mobile number<input name="phone" value={form.phone} onChange={handleFormChange} required inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" /></label>
                </>
              )}
              <label>Email address<input name="email" type="email" value={form.email} onChange={handleFormChange} required autoComplete="email" /></label>
              <label>Password<input name="password" type="password" value={form.password} onChange={handleFormChange} required minLength={10} maxLength={128} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>
              {mode === 'login' && <button type="button" className="account-forgot" onClick={handleForgotPassword} disabled={accountBusy}>Forgot password?</button>}
              {mode === 'register' && <p className="password-guidance">Use 10–128 characters with a letter and number.</p>}
              {accountError && <p className="account-error" role="alert">{accountError}</p>}
              <button className="account-submit" type="submit" disabled={accountBusy}>{accountBusy ? 'Please wait…' : mode === 'register' ? 'Create account & continue' : 'Sign in & continue'}</button>
            </form>
            {notice && <p className="account-notice" role="status">{notice}</p>}
            <div className="account-divider"><span>or</span></div>
            <div className="google-auth-container" ref={googleButtonRef} aria-label="Continue with Google" />
            {googleError && <p className="account-error google-auth-error" role="alert">{googleError}</p>}
            <p className="account-security-note"><ShieldCheck size={17} /> Passwords are securely hashed. ANNS never receives your Google password.</p>
            <p className="account-terms">By continuing, you agree to our <a href="/terms-conditions">Terms</a> and <a href="/privacy-policy">Privacy Policy</a>.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Account;
