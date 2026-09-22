# Razorpay checkout setup

ANNS uses Razorpay Standard Checkout. The browser never receives the Key Secret. Product prices are recalculated from MongoDB before a Razorpay order is created. Checkout requires a backend-verified customer session, and inventory is committed in a MongoDB transaction only after the backend verifies and captures the payment.

## Required environment variables

```text
RAZORPAY_KEY_ID=rzp_test_or_live_key_id
RAZORPAY_KEY_SECRET=server_only_key_secret
RAZORPAY_WEBHOOK_SECRET=separate_webhook_secret
MONGODB_URI=mongodb_atlas_connection_string
MONGODB_DB_NAME=anns
```

Use test keys during development. Never commit `local.settings.json`, `.env` files, Key Secrets or webhook secrets.

## Local development

Run both the storefront and API from the project root:

```bash
npm run dev
```

The API reads `api/local.settings.json` locally. You may set the two Razorpay
test-key variables directly or set `RAZORPAY_CREDENTIALS_FILE` to the absolute
path of the test-key CSV downloaded from Razorpay. The CSV option is only for
local development; production must use protected environment variables.

## Razorpay webhook

After the production backend is deployed, configure this HTTPS endpoint in Razorpay:

```text
https://annsonline.shop/api/payments/razorpay/webhook
```

Subscribe to:

- `payment.captured`
- `payment.failed`
- `order.paid`

Use a strong, separate webhook secret and add the same value as `RAZORPAY_WEBHOOK_SECRET` in the hosting environment.

## Production checklist

1. Rotate any credential that has been shared outside the hosting secret manager.
2. Complete Razorpay activation and KYC.
3. Deploy the backend behind HTTPS.
4. Add the live keys only as hosting environment variables.
5. Configure and test the signed webhook.
6. Run a low-value live payment and confirm the order, stock and customer history in MongoDB.
7. Confirm the order has `inventoryStatus: committed`. If it says
   `review_required`, fulfill or refund it manually before processing more orders.
