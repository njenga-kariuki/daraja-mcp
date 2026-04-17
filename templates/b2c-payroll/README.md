# M-Pesa B2C Payroll

Send salary/business payments to many recipients via M-Pesa B2C. Includes a verified callback handler and per-request rate limiting.

## What this does

- `POST /api/send` — send a single B2C payment (one recipient)
- `POST /api/send/batch` — send up to 100 payments in one batch
- `POST /api/callback` — Safaricom hits this with the async result; the handler verifies the source IP, dedupes duplicates, and logs the outcome

## Setup

1. Get your Daraja credentials (free):
   - Go to developer.safaricom.co.ke
   - Sign up or log in
   - Create a new app, copy your Consumer Key and Consumer Secret

2. B2C needs a **public callback URL** (Daraja delivers results asynchronously). For local dev, use ngrok:
   ```bash
   npx ngrok http 3000
   # copy the https URL ngrok prints
   ```

3. Set credentials and the callback base URL:
   ```bash
   export DARAJA_CONSUMER_KEY=your_key
   export DARAJA_CONSUMER_SECRET=your_secret
   export MPESA_CALLBACK_BASE_URL=https://your-ngrok-url
   npm install
   npm start
   ```

## Try it

```bash
# single payment
curl -X POST http://localhost:3000/api/send \
  -H 'Content-Type: application/json' \
  -d '{"amount": 100, "phone": "254708374149", "type": "salary"}'

# batch
curl -X POST http://localhost:3000/api/send/batch \
  -H 'Content-Type: application/json' \
  -d '{"payments": [{"amount": 100, "phone": "254708374149"}, {"amount": 200, "phone": "254708374149"}]}'
```

Sandbox runs against phone 254708374149 — no real money moves.

## Security notes

- **Callback verification**: in production (`NODE_ENV=production`), only Safaricom's IPs are accepted on `/api/callback`. In dev, the check is relaxed to allow ngrok. A warning is logged in dev mode.
- **Amount bounds**: 1–150,000 KES per payment is enforced server-side before the SDK call.
- **Batch cap**: 100 payments per `/api/send/batch` request.
- **Rate limits**: `/api/send` allows 5 requests/min per IP; `/api/send/batch` allows 1/min.

When you deploy, set `NODE_ENV=production` and point `MPESA_CALLBACK_BASE_URL` to your HTTPS endpoint.
