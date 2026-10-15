const ADMIN_SESSION_STORAGE = 'anns-admin-session';
export const AUTH_SESSION_STORAGE = 'anns-auth-session';

const readAuthToken = () => {
  try {
    return JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE))?.token || '';
  } catch {
    return '';
  }
};

const request = async (path, options = {}) => {
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.admin ? { 'x-admin-session': sessionStorage.getItem(ADMIN_SESSION_STORAGE) || '' } : {}),
      ...(options.auth ? { Authorization: `Bearer ${readAuthToken()}` } : {}),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `API request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return body;
};

export const verifyAdminKey = async (key) => {
  const response = await fetch('/api/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.token) throw new Error('Invalid admin password');
  sessionStorage.setItem(ADMIN_SESSION_STORAGE, body.token);
  return true;
};

export const clearAdminKey = () => sessionStorage.removeItem(ADMIN_SESSION_STORAGE);
export const hasAdminKey = () => Boolean(sessionStorage.getItem(ADMIN_SESSION_STORAGE));

export const getDatabaseHealth = () => request('health');
export const getProductsFromDatabase = () => request('products');
export const getCustomersFromDatabase = () => request('customers', { admin: true });
export const getOrdersFromDatabase = () => request('orders', { admin: true });
export const getPublishedReviews = () => request('reviews');
export const getAdminReviews = () => request('admin/reviews', { admin: true });

export const saveReviewToDatabase = (review) => request('admin/reviews', {
  method: 'POST',
  admin: true,
  body: JSON.stringify({ review }),
});

export const deleteReviewsFromDatabase = (ids) => request('admin/reviews', {
  method: 'DELETE',
  admin: true,
  body: JSON.stringify({ ids }),
});

export const deleteCustomersFromDatabase = (ids) => request('customers', {
  method: 'DELETE',
  admin: true,
  body: JSON.stringify({ ids }),
});

export const authenticateWithGoogle = (credential) => request('auth/google', {
  method: 'POST',
  body: JSON.stringify({ credential }),
});

export const getAuthSession = () => request('auth/session', { auth: true });

export const closeAuthSession = () => request('auth/session', { method: 'DELETE', auth: true });

export const saveProductsToDatabase = (products) => request('products', {
  method: 'POST',
  admin: true,
  body: JSON.stringify({ products }),
});

export const deleteProductsFromDatabase = (ids) => request('products', {
  method: 'DELETE',
  admin: true,
  body: JSON.stringify({ ids }),
});

export const syncCustomerToDatabase = (customer) => request('customers', {
  method: 'POST',
  auth: true,
  body: JSON.stringify(customer),
});

export const saveOrderToDatabase = (order) => request('orders', {
  method: 'POST',
  body: JSON.stringify(order),
});

export const createRazorpayOrder = (checkout) => request('payments/razorpay/create-order', {
  method: 'POST',
  auth: true,
  body: JSON.stringify(checkout),
});

export const verifyRazorpayPayment = (payment) => request('payments/razorpay/verify', {
  method: 'POST',
  auth: true,
  body: JSON.stringify(payment),
});
