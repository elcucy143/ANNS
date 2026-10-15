const crypto = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');

const DEFAULT_GOOGLE_CLIENT_ID = '920368340836-j753510od9dn8ced4due5p1787e35ghc.apps.googleusercontent.com';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const getGoogleClientId = () => process.env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;

const verifyFirebaseCredential = async (idToken, expectedPhone) => {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!idToken || !apiKey) {
    const error = new Error('Phone authentication is not configured');
    error.status = 503;
    throw error;
  }
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const result = await response.json().catch(() => ({}));
  const profile = result.users?.[0];
  let claims = {};
  try {
    claims = JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8'));
  } catch {
    claims = {};
  }
  const now = Math.floor(Date.now() / 1000);
  const authenticatedRecently = Number.isFinite(claims.auth_time)
    && claims.auth_time <= now + 60
    && claims.auth_time >= now - 5 * 60;
  const phoneProvider = claims.firebase?.sign_in_provider === 'phone';
  const phoneMatches = String(expectedPhone || '') === String(profile?.phoneNumber || '');
  if (!response.ok || !profile?.localId || !profile.phoneNumber || !authenticatedRecently || !phoneProvider || !phoneMatches) {
    const error = new Error('Firebase could not verify this phone number');
    error.status = 401;
    throw error;
  }
  return {
    id: `phone:${profile.localId}`,
    name: `Customer ${profile.phoneNumber.slice(-4)}`,
    email: String(profile.email || '').slice(0, 254),
    phone: String(profile.phoneNumber).slice(0, 30),
    picture: String(profile.photoUrl || '').slice(0, 1000),
    provider: 'phone',
  };
};

const getSessionSecret = () => {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error('Customer authentication is not configured');
    error.status = 503;
    throw error;
  }
  return secret;
};

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

const safeEqual = (first, second) => {
  const firstBuffer = Buffer.from(String(first || ''));
  const secondBuffer = Buffer.from(String(second || ''));
  return firstBuffer.length === secondBuffer.length && crypto.timingSafeEqual(firstBuffer, secondBuffer);
};

const signSession = (user) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture,
    phone: user.phone,
    provider: user.provider || 'google',
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const encodedPayload = encode(payload);
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
};

const verifySession = (token) => {
  const [encodedPayload, signature] = String(token || '').split('.');
  if (!encodedPayload || !signature) return null;
  const expected = crypto.createHmac('sha256', getSessionSecret()).update(encodedPayload).digest('base64url');
  if (!safeEqual(expected, signature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};

const signAdminSession = () => signSession({
  id: 'admin',
  name: 'ANNS Administrator',
  email: '',
  picture: '',
  provider: 'admin',
});

const verifyAdminSession = (token) => {
  const session = verifySession(token);
  return Boolean(session?.sub === 'admin' && session?.provider === 'admin');
};

const authenticateRequest = (request) => {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  return verifySession(authorization.slice(7));
};

const verifyGoogleCredential = async (credential) => {
  if (!credential) {
    const error = new Error('Google credential is required');
    error.status = 400;
    throw error;
  }
  const client = new OAuth2Client(getGoogleClientId());
  const ticket = await client.verifyIdToken({ idToken: credential, audience: getGoogleClientId() });
  const profile = ticket.getPayload();
  if (!profile?.sub || !profile.email || !profile.email_verified) {
    const error = new Error('Google could not verify this account');
    error.status = 401;
    throw error;
  }
  return {
    id: profile.sub,
    name: String(profile.name || profile.email.split('@')[0]).slice(0, 120),
    email: String(profile.email).slice(0, 254),
    picture: String(profile.picture || '').slice(0, 1000),
    provider: 'google',
  };
};

module.exports = {
  authenticateRequest,
  getGoogleClientId,
  signAdminSession,
  signSession,
  verifyAdminSession,
  verifyFirebaseCredential,
  verifyGoogleCredential,
  verifySession,
};
