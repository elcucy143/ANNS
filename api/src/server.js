const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const apiRoot = path.resolve(__dirname, '..');

const loadLocalSettings = () => {
  const settingsPath = path.join(apiRoot, 'local.settings.json');
  if (!fs.existsSync(settingsPath)) return;
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  for (const [key, value] of Object.entries(settings.Values || {})) {
    if (process.env[key] === undefined && value !== undefined) process.env[key] = String(value);
  }

  if ((!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) && process.env.RAZORPAY_CREDENTIALS_FILE) {
    const csv = fs.readFileSync(process.env.RAZORPAY_CREDENTIALS_FILE, 'utf8');
    const values = new Map(csv.split(/\r?\n/).slice(1).map((line) => {
      const separator = line.indexOf(',');
      return separator < 0 ? ['', ''] : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }));
    process.env.RAZORPAY_KEY_ID ||= values.get('Test Key ID');
    process.env.RAZORPAY_KEY_SECRET ||= values.get('Test Key Secret');
  }
};

loadLocalSettings();
const { registeredRoutes } = require('./functions/data');

const server = express();
server.disable('x-powered-by');
server.use(express.raw({ type: '*/*', limit: '2mb' }));

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

const port = Number(process.env.PORT || 7071);
const host = process.env.HOST || '0.0.0.0';
server.listen(port, host, () => console.log(`ANNS web app listening on ${host}:${port}`));
