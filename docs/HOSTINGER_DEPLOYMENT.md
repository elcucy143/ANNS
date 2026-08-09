# Hostinger deployment

ANNS is deployed as one Node.js web application. The Express process serves the
built Vite storefront and all `/api` routes from the same domain.

## Hostinger build settings

- Framework: `Express.js` or `Other`
- Node.js: `22.x`
- Install command: `npm install` (automatic)
- Build command: `npm run build`
- Start command: `npm start`
- Entry file, if requested: `api/src/server.js`
- Output directory, if requested: `dist`

## Production environment variables

Add these in hPanel. Never add them to GitHub:

```text
MONGODB_URI=your_mongodb_atlas_connection_string
MONGODB_DB_NAME=anns
ADMIN_API_KEY=a_long_random_admin_secret
RAZORPAY_KEY_ID=your_new_live_key_id
RAZORPAY_KEY_SECRET=your_new_live_key_secret
RAZORPAY_WEBHOOK_SECRET=a_separate_random_webhook_secret
```

Do not set `RAZORPAY_CREDENTIALS_FILE` in Hostinger. That setting is only for
the local test-key CSV.

## Domain and webhook

Attach `annsonline.shop`, enable SSL, and force HTTPS. After the site is live,
add this webhook in Razorpay and subscribe to `payment.captured`,
`payment.failed`, and `order.paid`:

```text
https://annsonline.shop/api/payments/razorpay/webhook
```

Use the same webhook secret in Razorpay and `RAZORPAY_WEBHOOK_SECRET`.
