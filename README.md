# Daraja POC

A working proof-of-concept integration with the Safaricom **Daraja** (M-Pesa)
APIs. Covers the full surface area you typically need for a merchant / fintech
integration:

| Area                     | Endpoint                        | Notes |
| ------------------------ | ------------------------------- | ----- |
| OAuth                    | `GET /oauth/v1/generate`        | Token is cached & auto-refreshed |
| STK Push (Lipa Na M-Pesa)| `POST /mpesa/stkpush/v1/processrequest` | Customer sees PIN prompt |
| STK Push Query           | `POST /mpesa/stkpushquery/v1/query`     | Poll status by CheckoutRequestID |
| C2B Register URLs        | `POST /mpesa/c2b/v1/registerurl`        | Validation + confirmation |
| C2B Simulate             | `POST /mpesa/c2b/v1/simulate`           | Sandbox only |
| B2C Payment              | `POST /mpesa/b2c/v1/paymentrequest`     | RSA-encrypted security credential |
| Transaction Status       | `POST /mpesa/transactionstatus/v1/query`| |
| Account Balance          | `POST /mpesa/accountbalance/v1/query`   | |
| Reversal                 | `POST /mpesa/reversal/v1/request`       | |

A small Express server exposes friendly `/api/*` routes, a set of
`/callbacks/*` handlers that record every async result to memory, and a
dashboard at `/` to exercise everything from a browser.

---

## 1. Setup

```bash
cp env.example .env
# Fill in DARAJA_CONSUMER_KEY / DARAJA_CONSUMER_SECRET from developer.safaricom.co.ke

npm install
```

For B2C / Status / Balance / Reversal, download `SandboxCertificate.cer` from
the Daraja portal and drop it in `./certs/` (see `certs/README.md`).

### Exposing callbacks publicly

Daraja's servers must reach your callback URLs. Easiest way locally:

```bash
# in another tab
ngrok http 3000
# → copy the https URL into PUBLIC_BASE_URL in .env
```

## 2. Run

```bash
npm start                    # → http://localhost:3000
npm run dev                  # node --watch for hot reload
npm run smoke 254708374149 1 # OAuth + STK Push sanity check
```

Open `http://localhost:3000` — the dashboard has buttons for every API and a
live feed of any callbacks received.

## 3. Sandbox test credentials

| Item                 | Value |
| -------------------- | ----- |
| STK Push shortcode   | `174379` |
| STK Push passkey     | `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919` |
| Test MSISDN          | `254708374149` |
| B2C shortcode        | `600999` (or any of `600977`, `600978`…) |
| Initiator name       | `testapi` |
| Initiator password   | `Safaricom999!*!` |

## 4. Project layout

```
daraja-poc/
├── env.example                 # copy to .env
├── package.json
├── scripts/
│   └── smoke.js                # OAuth + STK Push end-to-end check
├── certs/                      # drop SandboxCertificate.cer here
├── public/
│   └── index.html              # browser dashboard
└── src/
    ├── index.js                # Express server
    ├── utils/
    │   ├── config.js           # env loader
    │   ├── logger.js
    │   └── security.js         # timestamp, password, RSA encryption, msisdn
    ├── daraja/
    │   ├── client.js           # axios + OAuth interceptor + 401 retry
    │   ├── stkPush.js
    │   ├── c2b.js
    │   ├── b2c.js
    │   ├── transaction.js
    │   ├── balance.js
    │   └── reversal.js
    └── routes/
        ├── api.js              # POST /api/stkpush, /api/b2c, …
        └── callbacks.js        # Safaricom → us; recorded + ACKed
```

## 5. Going to production

1. Switch `DARAJA_ENV=production` and use production consumer key/secret.
2. Replace `MPESA_SHORTCODE` / `MPESA_PASSKEY` with your paybill/till + passkey.
3. Swap `certs/SandboxCertificate.cer` → `certs/ProductionCertificate.cer` and
   update `MPESA_CERT_PATH`.
4. Host the service somewhere Daraja can hit (Railway, Cloud Run, etc.) and set
   `PUBLIC_BASE_URL` to that hostname.
5. Replace the in-memory `events` array in `src/routes/callbacks.js` with a
   real store (Postgres / Redis / Firestore) and idempotency keys.
