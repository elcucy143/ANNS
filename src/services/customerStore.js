import { syncCustomerToDatabase } from './apiClient';

export const CUSTOMERS_STORAGE_KEY = 'anns-customers';
export const ORDERS_STORAGE_KEY = 'anns-orders';
export const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

const readList = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

export const readCustomers = () => readList(CUSTOMERS_STORAGE_KEY);
export const readOrders = () => readList(ORDERS_STORAGE_KEY);

export const getCustomerId = (user) => (
  user.id
  || (user.email ? `email:${user.email.toLowerCase()}` : '')
  || (user.phone ? `phone:${user.phone}` : '')
  || `customer:${Date.now()}`
);

export const upsertCustomer = (user) => {
  const customers = readCustomers();
  const id = getCustomerId(user);
  const now = new Date().toISOString();
  const existingIndex = customers.findIndex((customer) => customer.id === id);
  const existing = existingIndex >= 0 ? customers[existingIndex] : null;
  const customer = {
    ...existing,
    id,
    name: user.name || existing?.name || 'ANNS Customer',
    email: user.email || existing?.email || '',
    phone: user.phone || existing?.phone || '',
    picture: user.picture || existing?.picture || '',
    provider: user.provider || existing?.provider || 'email',
    createdAt: existing?.createdAt || now,
    lastSeenAt: now,
    sessionActive: true,
  };

  if (existingIndex >= 0) customers[existingIndex] = customer;
  else customers.push(customer);
  localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));
  syncCustomerToDatabase(customer).catch(() => {});
  return customer;
};

export const markCustomerInactive = (user) => {
  const id = getCustomerId(user);
  const customers = readCustomers();
  const nextCustomers = customers.map((customer) => (
    customer.id === id
      ? { ...customer, sessionActive: false, lastSeenAt: new Date().toISOString() }
      : customer
  ));
  localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(nextCustomers));
  const inactiveCustomer = nextCustomers.find((customer) => customer.id === id);
  if (inactiveCustomer) syncCustomerToDatabase(inactiveCustomer).catch(() => {});
};

export const isCustomerActive = (customer, now = Date.now()) => (
  customer.sessionActive
  && Number.isFinite(Date.parse(customer.lastSeenAt))
  && now - Date.parse(customer.lastSeenAt) <= ACTIVE_WINDOW_MS
);
