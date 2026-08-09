import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Eye, EyeOff, LogOut, Mail, ShieldCheck, Smartphone, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GOOGLE_CLIENT_ID, GOOGLE_IDENTITY_SCRIPT_ID } from '../config/auth';
import './Account.css';

const DEMO_OTP = '123456';

const decodeGoogleCredential = (credential) => {
  const encodedPayload = credential.split('.')[1];
  if (!encodedPayload) throw new Error('Google returned an invalid credential.');

  const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const json = decodeURIComponent(
    window.atob(paddedBase64)
      .split('')
      .map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''),
  );

  return JSON.parse(json);
};

const Account = () => {
  const { user, signInWithEmail, signInWithPhone, signInWithGoogle, signOut } = useAuth();
  const [mode, setMode] = useState('login');
  const [method, setMethod] = useState('email');
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [googleError, setGoogleError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', otp: '' });
  const googleButtonRef = useRef(null);

  useEffect(() => {
    if (user) return undefined;

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        ux_mode: 'popup',
        auto_select: false,
        callback: ({ credential }) => {
          try {
            const profile = decodeGoogleCredential(credential);
            const hasValidAudience = profile.aud === GOOGLE_CLIENT_ID;
            const hasNotExpired = Number(profile.exp) * 1000 > Date.now();

            if (!hasValidAudience || !hasNotExpired || !profile.email_verified) {
              throw new Error('Google could not verify this account.');
            }

            setGoogleError('');
            signInWithGoogle(profile);
          } catch (credentialError) {
            setGoogleError(credentialError.message || 'Google sign-in failed. Please try again.');
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
  }, [mode, signInWithGoogle, user]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setOtpSent(false);
  };

  const handleEmail = (event) => {
    event.preventDefault();
    if (mode === 'register' && form.name.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }
    signInWithEmail(form);
  };

  const requestOtp = (event) => {
    event.preventDefault();
    if (mode === 'register' && form.name.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!/^\d{10}$/.test(form.phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setError('');
    setOtpSent(true);
  };

  const verifyOtp = (event) => {
    event.preventDefault();
    if (form.otp !== DEMO_OTP) {
      setError('That OTP is incorrect. Use 123456 for this preview.');
      return;
    }
    signInWithPhone(form);
  };

  if (user) {
    return (
      <section className="account-page account-dashboard-page">
        <div className="account-dashboard">
          <div className="account-success-icon"><Check size={30} /></div>
          <p className="account-eyebrow">MY ACCOUNT</p>
          <h1>Welcome, {user.name}</h1>
          <p className="account-welcome">You’re signed in and ready to continue shopping with ANNS.</p>
          <div className="account-profile-card">
            <UserRound size={24} />
            <div>
              <span>Account details</span>
              <strong>{user.email || `+91 ${user.phone}`}</strong>
            </div>
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
              <p>{mode === 'login' ? 'Welcome back. Enter your details to continue.' : 'Join ANNS for a more personal shopping experience.'}</p>
            </div>

            <div className="account-tabs" role="tablist" aria-label="Account action">
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Sign in</button>
              <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Register</button>
            </div>

            <div className="google-auth-container" ref={googleButtonRef} aria-label="Google account sign-in" />
            {googleError && <p className="account-error google-auth-error" role="alert">{googleError}</p>}

            <div className="account-divider"><span>or continue with</span></div>

            <div className="method-switch" role="tablist" aria-label="Sign-in method">
              <button type="button" className={method === 'email' ? 'active' : ''} onClick={() => { setMethod('email'); setError(''); }}>
                <Mail size={17} /> Email
              </button>
              <button type="button" className={method === 'phone' ? 'active' : ''} onClick={() => { setMethod('phone'); setError(''); }}>
                <Smartphone size={17} /> Mobile OTP
              </button>
            </div>

            {method === 'email' ? (
              <form className="account-form" onSubmit={handleEmail} noValidate>
                {mode === 'register' && (
                  <label>Full name<input name="name" value={form.name} onChange={updateField} placeholder="Your full name" autoComplete="name" /></label>
                )}
                <label>Email address<input name="email" type="email" value={form.email} onChange={updateField} placeholder="you@gmail.com" autoComplete="email" /></label>
                <label>Password
                  <span className="password-field">
                    <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={updateField} placeholder="Minimum 6 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                    <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                  </span>
                </label>
                {mode === 'login' && <button type="button" className="forgot-link">Forgot password?</button>}
                {error && <p className="account-error" role="alert">{error}</p>}
                <button type="submit" className="account-submit">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
              </form>
            ) : (
              <form className="account-form" onSubmit={otpSent ? verifyOtp : requestOtp} noValidate>
                {mode === 'register' && !otpSent && (
                  <label>Full name<input name="name" value={form.name} onChange={updateField} placeholder="Your full name" autoComplete="name" /></label>
                )}
                {!otpSent ? (
                  <label>Mobile number
                    <span className="phone-field"><span>+91</span><input name="phone" inputMode="numeric" maxLength="10" value={form.phone} onChange={updateField} placeholder="10-digit number" autoComplete="tel" /></span>
                  </label>
                ) : (
                  <>
                    <div className="otp-sent"><Check size={17} /> OTP sent to +91 {form.phone}</div>
                    <label>Enter 6-digit OTP<input name="otp" inputMode="numeric" maxLength="6" value={form.otp} onChange={updateField} placeholder="••••••" autoComplete="one-time-code" /></label>
                    <p className="demo-otp">Preview OTP: <strong>{DEMO_OTP}</strong></p>
                  </>
                )}
                {error && <p className="account-error" role="alert">{error}</p>}
                <button type="submit" className="account-submit">{otpSent ? 'Verify & continue' : 'Send OTP'}</button>
                {otpSent && <button type="button" className="change-number" onClick={() => { setOtpSent(false); setForm((current) => ({ ...current, otp: '' })); }}>Change mobile number</button>}
              </form>
            )}

            <p className="account-terms">By continuing, you agree to our <a href="/terms-conditions">Terms</a> and <a href="/privacy-policy">Privacy Policy</a>.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Account;
