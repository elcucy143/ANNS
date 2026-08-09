import React, { createContext, useContext, useState } from 'react';
import { getCustomerId, markCustomerInactive, upsertCustomer } from '../services/customerStore';

const AuthContext = createContext(null);
const STORAGE_KEY = 'anns-user';

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const restoredUser = readStoredUser();
    if (restoredUser) upsertCustomer(restoredUser);
    return restoredUser;
  });

  const saveUser = (nextUser) => {
    const customerUser = { ...nextUser, id: getCustomerId(nextUser) };
    upsertCustomer(customerUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customerUser));
    setUser(customerUser);
    return customerUser;
  };

  const signInWithEmail = ({ email, name }) => saveUser({
    name: name || email.split('@')[0],
    email,
    provider: 'email',
  });

  const signInWithPhone = ({ phone, name }) => saveUser({
    name: name || 'ANNS Customer',
    phone,
    provider: 'phone',
  });

  const signInWithGoogle = (profile) => saveUser({
    id: profile.sub,
    name: profile.name,
    email: profile.email,
    picture: profile.picture,
    provider: 'google',
  });

  const signOut = () => {
    window.google?.accounts?.id?.disableAutoSelect();
    if (user) markCustomerInactive(user);
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  const value = {
    user,
    signInWithEmail,
    signInWithPhone,
    signInWithGoogle,
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
