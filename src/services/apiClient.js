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
// The catalogue endpoint is CDN cached briefly. Let the browser reuse and
// conditionally validate it instead of forcing a full 0.5–1 MB download on
// every background refresh as the catalogue grows.
export const getProductsFromDatabase = () => request('products');
export const getCustomersFromDatabase = () => request('customers', { admin: true });
export const getOrdersFromDatabase = () => request('orders', { admin: true });
export const updateOrderFulfillment = (order) => request('orders', {
  method: 'PATCH',
  admin: true,
  body: JSON.stringify(order),
});
export const approveOrderCancellation = (id) => request('orders', {
  method: 'PATCH', admin: true, body: JSON.stringify({ id, action: 'approve-cancellation' }),
});
export const getPublishedReviews = () => request('reviews');
export const getAdminReviews = () => request('admin/reviews', { admin: true });
export const getFlashSale = () => request('flash-sale');
export const getHomepageBanners = () => request('homepage-banners');
export const getInstagramReels = () => request('instagram/reels');
export const getAdminFlashSale = () => request('admin/flash-sale', { admin: true, cache: 'no-store' });
export const getAdminHomepageBanners = () => request('admin/homepage-banners', { admin: true, cache: 'no-store' });
export const getAdminAnalytics = (days = 30, page = 1, limit = 50) => request(`analytics?days=${days}&page=${page}&limit=${limit}`, { admin: true, cache: 'no-store' });
export const getAdminStorageCapacity = () => request('admin/storage-capacity', { admin: true, cache: 'no-store' });

export const recordPageView = (event) => request('analytics', {
  method: 'POST',
  auth: true,
  body: JSON.stringify(event),
});

export const sendContactMessage = (message) => request('contact', {
  method: 'POST',
  body: JSON.stringify(message),
});

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

export const saveFlashSale = (sale) => request('admin/flash-sale', {
  method: 'POST',
  admin: true,
  body: JSON.stringify({ sale }),
});

export const deleteFlashSale = () => request('admin/flash-sale', {
  method: 'DELETE',
  admin: true,
});

export const saveHomepageBanners = (slides) => request('admin/homepage-banners', {
  method: 'POST',
  admin: true,
  body: JSON.stringify({ slides }),
});

export const normalizeAdminImage = (file, purpose = 'image') => request('admin/image-normalize', {
  method: 'POST',
  admin: true,
  headers: {
    'Content-Type': file.type || 'application/octet-stream',
    'x-file-name': encodeURIComponent(file.name || 'admin-image'),
    'x-image-purpose': purpose,
  },
  body: file,
}).then((result) => {
  if (!result?.image) throw new Error(`${file.name} could not be normalized.`);
  return result.image;
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

export const registerWithCredentials = (account) => request('auth/register', {
  method: 'POST',
  body: JSON.stringify(account),
});

export const authenticateWithCredentials = (email, password) => request('auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
export const requestPasswordReset = (email) => request('auth/forgot-password', {
  method: 'POST', body: JSON.stringify({ email }),
});
export const resetPassword = (token, password) => request('auth/reset-password', {
  method: 'POST', body: JSON.stringify({ token, password }),
});
export const getMyOrders = () => request('account/orders', { auth: true });
export const getMyWishlist = () => request('account/wishlist', { auth: true, cache: 'no-store' });
export const saveMyWishlist = (ids) => request('account/wishlist', {
  method: 'PUT', auth: true, body: JSON.stringify({ ids }),
});
export const getMyProductReview = (productId) => request(`account/reviews?productId=${encodeURIComponent(productId)}`, { auth: true });
export const saveMyProductReview = (review) => request('account/reviews', {
  method: 'POST', auth: true, body: JSON.stringify(review),
});
export const requestOrderCancellation = (id, reason) => request('account/orders', {
  method: 'POST', auth: true, body: JSON.stringify({ id, reason }),
});

export const authenticateWithFirebase = (idToken, phone) => request('auth/firebase', {
  method: 'POST',
  body: JSON.stringify({ idToken, phone }),
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
