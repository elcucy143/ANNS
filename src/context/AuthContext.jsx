import React, { createContext, useContext, useEffect, useState } from 'react';
import { signOut as signOutFirebase } from '@firebase/auth';
import {
  AUTH_SESSION_STORAGE,
  authenticateWithFirebase,
  authenticateWithGoogle,
  closeAuthSession,
  getAuthSession,
} from '../services/apiClient';
import { firebaseAuth } from '../config/firebase';

const AuthContext = createContext(null);
const readStoredSession = () => {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE));
    return session?.user && session?.token ? session : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(readStoredSession);
  const user = session?.user || null;
  const sessionToken = session?.token;

  useEffect(() => {
    if (!sessionToken) return;
    getAuthSession()
      .then(({ user: verifiedUser }) => {
        setSession((currentSession) => {
          const verifiedSession = { ...currentSession, user: verifiedUser };
          localStorage.setItem(AUTH_SESSION_STORAGE, JSON.stringify(verifiedSession));
          return verifiedSession;
        });
      })
      .catch(() => {
        localStorage.removeItem(AUTH_SESSION_STORAGE);
        setSession(null);
      });
  }, [sessionToken]);

  const signInWithGoogle = async (credential) => {
    const authenticatedSession = await authenticateWithGoogle(credential);
    localStorage.setItem(AUTH_SESSION_STORAGE, JSON.stringify(authenticatedSession));
    setSession(authenticatedSession);
    return authenticatedSession.user;
  };

  const signInWithPhone = async (firebaseUser) => {
    const idToken = await firebaseUser.getIdToken(true);
    const authenticatedSession = await authenticateWithFirebase(idToken, firebaseUser.phoneNumber);
    localStorage.setItem(AUTH_SESSION_STORAGE, JSON.stringify(authenticatedSession));
    setSession(authenticatedSession);
    return authenticatedSession.user;
  };

  const signOut = () => {
    window.google?.accounts?.id?.disableAutoSelect();
    if (firebaseAuth) signOutFirebase(firebaseAuth).catch(() => {});
    if (session?.token) closeAuthSession().catch(() => {});
    localStorage.removeItem(AUTH_SESSION_STORAGE);
    setSession(null);
  };

  const value = {
    user,
    isLoading: Boolean(sessionToken && !user),
    signInWithGoogle,
    signInWithPhone,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Context and hook intentionally share a module to keep the provider API together.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
