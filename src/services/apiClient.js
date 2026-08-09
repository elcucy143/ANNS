const ADMIN_KEY_STORAGE = 'anns-admin-api-key';

const request = async (path, options = {}) => {
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.admin ? { 'x-admin-key': sessionStorage.getItem(ADMIN_KEY_STORAGE) || '' } : {}),
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
  if (!response.ok) throw new Error('Invalid admin password');
  sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
  return true;
};

export const clearAdminKey = () => sessionStorage.removeItem(ADMIN_KEY_STORAGE);
export const hasAdminKey = () => Boolean(sessionStorage.getItem(ADMIN_KEY_STORAGE));

export const getDatabaseHealth = () => request('health');
export const getProductsFromDatabase = () => request('products');
export const getCustomersFromDatabase = () => request('customers', { admin: true });
export const getOrdersFromDatabase = () => request('orders', { admin: true });

export const saveProductsToDatabase = (products) => request('products', {
  method: 'POST',
  admin: true,
  body: JSON.stringify({ products }),
});

export const syncCustomerToDatabase = (customer) => request('customers', {
  method: 'POST',
  body: JSON.stringify(customer),
});

export const saveOrderToDatabase = (order) => request('orders', {
  method: 'POST',
  body: JSON.stringify(order),
});
