import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GOOGLE_CLIENT_ID, GOOGLE_IDENTITY_SCRIPT_ID } from '../config/auth';
import './Account.css';

const Account = () => {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [mode, setMode] = useState('login');
  const [googleError, setGoogleError] = useState('');
  const googleButtonRef = useRef(null);

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
  }, [mode, signInWithGoogle, user]);

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
            <div><span>Account details</span><strong>{user.email}</strong></div>
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
              <p>Continue securely with your verified Google account.</p>
            </div>
            <div className="account-tabs" role="tablist" aria-label="Account action">
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setGoogleError(''); }}>Sign in</button>
              <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setGoogleError(''); }}>Register</button>
            </div>
            <div className="google-auth-container" ref={googleButtonRef} aria-label="Google account sign-in" />
            {googleError && <p className="account-error google-auth-error" role="alert">{googleError}</p>}
            <p className="account-security-note"><ShieldCheck size={17} /> Google verifies your identity securely. ANNS never receives your Google password.</p>
            <p className="account-terms">By continuing, you agree to our <a href="/terms-conditions">Terms</a> and <a href="/privacy-policy">Privacy Policy</a>.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Account;
