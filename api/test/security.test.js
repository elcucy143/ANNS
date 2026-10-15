const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const {
  signAdminSession, signSession, verifyAdminSession, verifyFirebaseCredential, verifySession,
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

test('phone sessions require a fresh Firebase phone verification for the same number', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.FIREBASE_API_KEY;
  process.env.FIREBASE_API_KEY = 'firebase-test-api-key-12345';
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ users: [{ localId: 'firebase-user', phoneNumber: '+919876543210' }] }),
  });
  const token = (claims) => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
  const now = Math.floor(Date.now() / 1000);
  try {
    const user = await verifyFirebaseCredential(token({ auth_time: now, firebase: { sign_in_provider: 'phone' } }), '+919876543210');
    assert.equal(user.phone, '+919876543210');
    await assert.rejects(
      verifyFirebaseCredential(token({ auth_time: now, firebase: { sign_in_provider: 'phone' } }), '+919999999999'),
      /could not verify/,
    );
    await assert.rejects(
      verifyFirebaseCredential(token({ auth_time: now - 600, firebase: { sign_in_provider: 'phone' } }), '+919876543210'),
      /could not verify/,
    );
    await assert.rejects(
      verifyFirebaseCredential(token({ auth_time: now, firebase: { sign_in_provider: 'google.com' } }), '+919876543210'),
      /could not verify/,
    );
  } finally {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.FIREBASE_API_KEY;
    else process.env.FIREBASE_API_KEY = originalApiKey;
  }
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
