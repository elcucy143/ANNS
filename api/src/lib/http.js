const crypto = require('node:crypto');
const { verifyAdminSession } = require('./auth');

const json = (body, status = 200) => ({
  status,
  jsonBody: body,
  headers: {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  },
});

const safeEqual = (first, second) => {
  const firstBuffer = Buffer.from(String(first || ''));
  const secondBuffer = Buffer.from(String(second || ''));
  return firstBuffer.length === secondBuffer.length && crypto.timingSafeEqual(firstBuffer, secondBuffer);
};

const isAdminKeyRequest = (request) => {
  const configuredKey = process.env.ADMIN_API_KEY;
  const suppliedKey = request.headers.get('x-admin-key');
  return Boolean(configuredKey && suppliedKey && safeEqual(configuredKey, suppliedKey));
};

const isAdminRequest = (request) => verifyAdminSession(request.headers.get('x-admin-session'));

const requireAdmin = (request) => (
  isAdminRequest(request) ? null : json({ error: 'Admin authorization required' }, 401)
);

const parseJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const handleError = (context, error) => {
  context.error(error);
  const configurationError = error.message?.includes('MONGODB_');
  return json({
    error: configurationError ? 'Database is not configured' : 'Database request failed',
  }, configurationError ? 503 : 500);
};

module.exports = { handleError, isAdminKeyRequest, isAdminRequest, json, parseJson, requireAdmin };
