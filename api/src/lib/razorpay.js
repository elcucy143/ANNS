const crypto = require('node:crypto');

const getCredentials = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    const error = new Error('Razorpay is not configured');
    error.status = 503;
    throw error;
  }
  return { keyId, keySecret };
};

const requestRazorpay = async (path, options = {}) => {
  const { keyId, keySecret } = getCredentials();
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error?.description || 'Razorpay request failed');
    error.status = 502;
    error.providerStatus = response.status;
    throw error;
  }
  return body;
};

const createRazorpayOrder = (order) => requestRazorpay('/orders', {
  method: 'POST',
  body: JSON.stringify(order),
});

const getRazorpayPayment = (paymentId) => requestRazorpay(`/payments/${encodeURIComponent(paymentId)}`);

const captureRazorpayPayment = (paymentId, amount) => requestRazorpay(`/payments/${encodeURIComponent(paymentId)}/capture`, {
  method: 'POST',
  body: JSON.stringify({ amount, currency: 'INR' }),
});

const safeEqual = (first, second) => {
  const firstBuffer = Buffer.from(String(first || ''));
  const secondBuffer = Buffer.from(String(second || ''));
  return firstBuffer.length === secondBuffer.length && crypto.timingSafeEqual(firstBuffer, secondBuffer);
};

const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
  const { keySecret } = getCredentials();
  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
};

const verifyWebhookSignature = (payload, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return safeEqual(expected, signature);
};

module.exports = {
  captureRazorpayPayment,
  createRazorpayOrder,
  getCredentials,
  getRazorpayPayment,
  verifyPaymentSignature,
  verifyWebhookSignature,
};
