const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const apiRoot = path.resolve(__dirname, '..');

const loadLocalSettings = () => {
  const settingsPath = path.join(apiRoot, 'local.settings.json');
  if (!fs.existsSync(settingsPath)) return;
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  for (const [key, value] of Object.entries(settings.Values || {})) {
    if (process.env[key] === undefined && value !== undefined) process.env[key] = String(value);
  }
};

loadLocalSettings();
const { registeredRoutes } = require('./functions/data');

const server = express();
server.disable('x-powered-by');
if (process.env.TRUST_PROXY) server.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
server.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://accounts.google.com', 'https://www.google.com', 'https://www.gstatic.com', 'https://checkout.razorpay.com', 'https://www.googletagmanager.com'],
      frameSrc: ["'self'", 'https://accounts.google.com', 'https://www.google.com', 'https://recaptcha.google.com', 'https://api.razorpay.com', 'https://*.razorpay.com'],
      connectSrc: ["'self'", 'https://accounts.google.com', 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://www.googleapis.com', 'https://*.razorpay.com', 'https://www.google-analytics.com', 'https://www.googletagmanager.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
      fontSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' },
});
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait before trying again.' },
});
server.use('/api', apiLimiter);
server.use([
  '/api/admin-login',
  '/api/auth/google',
  '/api/auth/firebase',
  '/api/auth/login',
  '/api/auth/register',
  '/api/payments/razorpay/create-order',
], sensitiveLimiter);
server.use(express.raw({ type: '*/*', limit: '4mb' }));

for (const route of registeredRoutes) {
  const endpoint = `/api/${route.route}`;
  for (const method of route.methods) {
    server[method.toLowerCase()](endpoint, async (req, res) => {
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const body = method === 'GET' || method === 'HEAD' ? undefined : req.body;
      const request = new Request(url, { method, headers: req.headers, body });
      const context = { error: (...args) => console.error(`[${route.name}]`, ...args) };
      try {
        const response = await route.handler(request, context);
        for (const [key, value] of Object.entries(response.headers || {})) res.setHeader(key, value);
        res.status(response.status || 200);
        if (response.jsonBody !== undefined) return res.json(response.jsonBody);
        return res.send(response.body || '');
      } catch (error) {
        context.error(error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    });
  }
}

server.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found' }));

const storefrontRoot = path.resolve(apiRoot, '..', 'dist');
if (fs.existsSync(storefrontRoot)) {
  server.use(express.static(storefrontRoot));
  server.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      return res.sendFile(path.join(storefrontRoot, 'index.html'));
    }
    return next();
  });
}

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
server.listen(port, host, () => console.log(`ANNS web app listening on ${host}:${port}`));
