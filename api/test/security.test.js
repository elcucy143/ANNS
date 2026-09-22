const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const {
  signAdminSession, signSession, verifyAdminSession, verifySession,
} = require('../src/lib/auth');
const { configurationProblems } = require('../src/lib/config');
const { verifyPaymentSignature, verifyWebhookSignature } = require('../src/lib/razorpay');

test('customer sessions reject tampering', () => {
  process.env.AUTH_SESSION_SECRET = 'test-session-secret-that-is-longer-than-32-characters';
  const token = signSession({ id: 'google-user', name: 'Test User', email: 'test@example.com' });
  assert.equal(verifySession(token).sub, 'google-user');
  assert.equal(verifySession(`${token.slice(0, -1)}x`), null);
  const adminToken = signAdminSession();
  assert.equal(verifyAdminSession(adminToken), true);
  assert.equal(verifyAdminSession(token), false);
});

test('Razorpay signatures use timing-safe HMAC verification', () => {
  process.env.RAZORPAY_KEY_ID = 'rzp_test_validkey123';
  process.env.RAZORPAY_KEY_SECRET = 'test-razorpay-secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update('order_1|pay_1').digest('hex');
  assert.equal(verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature }), true);
  assert.equal(verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_2', signature }), false);
  const payload = '{"event":"payment.captured"}';
  const webhookSignature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(payload).digest('hex');
  assert.equal(verifyWebhookSignature(payload, webhookSignature), true);
  assert.equal(verifyWebhookSignature(`${payload}x`, webhookSignature), false);
});

test('production readiness rejects missing and placeholder values', () => {
  const names = [
    'MONGODB_URI', 'MONGODB_DB_NAME', 'ADMIN_API_KEY', 'AUTH_SESSION_SECRET',
    'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET',
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  assert.ok(configurationProblems().includes('MONGODB_URI'));
  process.env.MONGODB_URI = 'mongodb+srv://user:password@example.mongodb.net/';
  assert.ok(configurationProblems().includes('MONGODB_URI'));
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
