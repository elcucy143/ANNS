import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from '@firebase/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, LogOut, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GOOGLE_CLIENT_ID, GOOGLE_IDENTITY_SCRIPT_ID } from '../config/auth';
import { firebaseAuth, firebaseConfigured } from '../config/firebase';
import './Account.css';

const Account = () => {
  const { user, signInWithGoogle, signInWithPhone, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [method, setMethod] = useState('phone');
  const [googleError, setGoogleError] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [phoneError, setPhoneError] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const googleButtonRef = useRef(null);
  const recaptchaRef = useRef(null);

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
        text: mode === 'register' ? 'signup_with' : 'signin_with',
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
  }, [continueAfterLogin, mode, method, signInWithGoogle, user]);

  useEffect(() => () => recaptchaRef.current?.clear(), []);

  const requestOtp = async (event) => {
    event.preventDefault();
    setPhoneError('');
    const digits = phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (digits.length !== 10) return setPhoneError('Enter a valid 10-digit Indian mobile number.');
    if (!firebaseConfigured || !firebaseAuth) return setPhoneError('Phone login is temporarily unavailable.');
    setPhoneBusy(true);
    try {
      recaptchaRef.current?.clear();
      recaptchaRef.current = new RecaptchaVerifier(firebaseAuth, 'phone-recaptcha', { size: 'invisible' });
      const result = await signInWithPhoneNumber(firebaseAuth, `+91${digits}`, recaptchaRef.current);
      setConfirmation(result);
    } catch (error) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      setPhoneError(error.code === 'auth/too-many-requests'
        ? 'Too many attempts. Please wait and try again.'
        : 'OTP could not be sent. Check the number and try again.');
    } finally {
      setPhoneBusy(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) return setPhoneError('Enter the 6-digit OTP.');
    setPhoneBusy(true);
    setPhoneError('');
    try {
      const credential = await confirmation.confirm(otp);
      await signInWithPhone(credential.user);
      continueAfterLogin();
    } catch {
      setPhoneError('The OTP is incorrect or expired. Please try again.');
    } finally {
      setPhoneBusy(false);
    }
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
          <a href="/" className="account-primary-link">Continue shopping</a>
          <button type="button" className="account-signout" onClick={signOut}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </section>
    );
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
              <p>Sign in with your mobile number or Google account to continue to checkout.</p>
            </div>
            <div className="account-tabs" role="tablist" aria-label="Account action">
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setGoogleError(''); }}>Sign in</button>
              <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setGoogleError(''); }}>Register</button>
            </div>
            <div className="method-switch" aria-label="Sign-in method">
              <button type="button" className={method === 'phone' ? 'active' : ''} onClick={() => setMethod('phone')}><Phone size={16} /> Mobile OTP</button>
              <button type="button" className={method === 'google' ? 'active' : ''} onClick={() => setMethod('google')}>Google</button>
            </div>
            {method === 'phone' ? (
              <form className="account-form" onSubmit={confirmation ? verifyOtp : requestOtp}>
                {!confirmation ? (
                  <label>Mobile number<div className="phone-field"><span>+91</span><input inputMode="numeric" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="10-digit mobile number" maxLength={14} /></div></label>
                ) : (
                  <>
                    <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" /></label>
                    <button type="button" className="change-number" onClick={() => { setConfirmation(null); setOtp(''); setPhoneError(''); }}>Change mobile number</button>
                  </>
                )}
                {phoneError && <p className="account-error" role="alert">{phoneError}</p>}
                <button className="account-submit" type="submit" disabled={phoneBusy}>{phoneBusy ? 'Please wait…' : confirmation ? 'Verify OTP & continue' : 'Send OTP'}</button>
                <div id="phone-recaptcha" />
              </form>
            ) : (
              <>
                <div className="google-auth-container" ref={googleButtonRef} aria-label="Google account sign-in" />
                {googleError && <p className="account-error google-auth-error" role="alert">{googleError}</p>}
              </>
            )}
            <p className="account-security-note"><ShieldCheck size={17} /> Your identity is verified securely. ANNS never receives your Google password or OTP.</p>
            <p className="account-terms">By continuing, you agree to our <a href="/terms-conditions">Terms</a> and <a href="/privacy-policy">Privacy Policy</a>.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Account;
