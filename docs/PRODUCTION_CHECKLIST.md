# ANNS production checklist

Run this checklist for every release.

## Before deployment

- Rotate every MongoDB or Razorpay credential ever pasted into chat, email, or a ticket.
- Keep secrets only in the hosting provider's encrypted environment settings.
- Use Node.js 20 or 22.
- Run `npm ci`, then `npm run check`.
- Confirm Google OAuth allows `https://annsonline.shop` and
  `https://www.annsonline.shop` as JavaScript origins.
- Confirm MongoDB Network Access permits the hosting provider. Prefer fixed
  outbound IPs over `0.0.0.0/0` when the hosting plan supports them.

## Required server settings

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `ADMIN_API_KEY` (at least 32 random characters)
- `AUTH_SESSION_SECRET` (a separate random value of at least 32 characters)
- `GOOGLE_CLIENT_ID`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `NODE_ENV=production`
- `TRUST_PROXY=1` when running behind the hosting provider's reverse proxy

## After deployment

- `/api/health` returns HTTP 200.
- Authenticated `/api/readiness` returns HTTP 200 and `ready: true`.
- Google sign-in and sign-out both work on the production domain.
- An unauthenticated checkout request returns HTTP 401.
- Admin login succeeds only with the production admin secret.
- Product listing, search, cart, checkout and order confirmation work on mobile
  and desktop.
- A controlled payment succeeds and appears in Razorpay and MongoDB.
- A test webhook delivery returns HTTP 200.
- The paid order has `paymentStatus: captured` and
  `inventoryStatus: committed`.
- SSL is valid and both `www` and apex domain redirect to one canonical host.

## Rollback

Keep the previous successful deployment available. If authentication, checkout,
or database health fails, route traffic back to it and disable live checkout
until the cause is resolved.
