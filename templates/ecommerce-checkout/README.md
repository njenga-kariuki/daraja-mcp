# M-Pesa E-commerce Checkout

Accept payment at checkout via M-Pesa STK Push. No callbacks needed — the SDK auto-polls for the result.

## What this does

- `POST /api/checkout` — create an order and trigger an STK Push to the customer's phone
- `GET /api/orders/:id` — look up an order by ID
- Serves static files from `public/` (drop your frontend there)

## Setup

1. Get your Daraja credentials (free):
   - Go to developer.safaricom.co.ke
   - Sign up or log in
   - Create a new app, copy your Consumer Key and Consumer Secret

2. Set credentials and run:
   ```bash
   export DARAJA_CONSUMER_KEY=your_key
   export DARAJA_CONSUMER_SECRET=your_secret
   npm install
   npm start
   ```

3. Open http://localhost:3000

## Try it

```bash
curl -X POST http://localhost:3000/api/checkout \
  -H 'Content-Type: application/json' \
  -d '{"phone": "254708374149", "items": [{"price": 500, "qty": 2}]}'
```

The sandbox runs against phone 254708374149 — no real money moves.

## Security notes

- **Amount bounds**: order total must be 1–150,000 KES. Totals outside this range are rejected with 400.
- **Non-empty items**: requests with missing or empty `items` are rejected.
- **Rate limit**: `/api/checkout` allows 10 requests/min per IP.
- **Server-side total**: the server computes the total from `items`, never trusting a client-provided total.

For production, serve behind HTTPS and validate catalog prices against your own product table — the template's per-item `price` is illustrative, not a trust boundary.
