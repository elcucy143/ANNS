import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/account" replace state={{ from: returnTo }} />;
  }

  return children;
};

export default ProtectedRoute;
