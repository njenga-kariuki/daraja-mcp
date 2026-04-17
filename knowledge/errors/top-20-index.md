# Top 20 Daraja Errors — Cheat Sheet

> Single-page entry point for the 24/7 M-Pesa Support Assistant. If you see it, look it up here first.

Each row links to a full decision tree or a specific fix. Paste any of these signatures into `daraja_diagnose` and the assistant returns root cause, fix, and prevention in one step.

---

## STK Push (collect)

| Signature | Meaning | Jump to |
|---|---|---|
| `ResultCode: 1032` | User cancelled or didn't enter PIN | [troubleshooting.md § 1032](troubleshooting.md) |
| `ResultCode: 1037` | Phone unreachable (off, no signal, iOS eSIM) | [ios-esim-and-dual-sim-timeouts.md](ios-esim-and-dual-sim-timeouts.md) |
| `ResultCode: 1025` or `9999` | STK Push delivery failed (usually TransactionDesc too long) | [error-codes.md § 1025](error-codes.md) |
| `ResultCode: 1001` | USSD session active on phone — blocks STK | [troubleshooting.md § USSD](troubleshooting.md) |
| `ResultCode: 2001` (on collect) | Customer entered wrong PIN too many times | [error-codes.md § 2001](error-codes.md) |
| Stuck on "pending" past 60s | Callback never arrived OR race with poll | [callback-vs-polling-race-conditions.md](../concepts/callback-vs-polling-race-conditions.md) |
| PIN prompt appears, customer enters PIN, still fails | Wallet limit, insufficient balance, or prompt expired | [stk-reached-phone-but-pin-fails.md](stk-reached-phone-but-pin-fails.md) |

## Amounts

| Signature | Meaning | Jump to |
|---|---|---|
| `ResultCode: 03` | Amount below minimum (< KES 1) | [error-codes.md § 03](error-codes.md) |
| `ResultCode: 04` | Amount above maximum (> KES 150,000 for STK) | [error-codes.md § 04](error-codes.md) |
| `ResultCode: 1` (on collect) | Customer has insufficient M-Pesa balance | [error-codes.md § 1](error-codes.md) |
| `ResultCode: 1` (on send) | **Your business float** is insufficient | [error-codes.md § 1](error-codes.md) |
| `ResultCode: 08` | Customer exceeded daily M-Pesa limit | [error-codes.md § 08](error-codes.md) |

## Auth & Credentials

| Signature | Meaning | Jump to |
|---|---|---|
| HTTP 401/403 on `/oauth/v1/generate` | Wrong consumer key/secret | [troubleshooting.md § OAuth](troubleshooting.md) |
| HTTP 401 on your callback endpoint | Your server rejected Daraja | [callbacks.md](../concepts/callbacks.md) |
| `SecurityCredential` error on B2C/balance/reverse | Wrong cert, wrong initiator password, or env mismatch | [initiator-or-shortcode-mismatch.md](initiator-or-shortcode-mismatch.md) |
| `ResultCode: 500.001.1001` | Invalid initiator information (B2C-specific 500) | [error-codes.md § 500.001.1001](error-codes.md) |
| `ResultCode: 36` or `42` | Passkey does not match shortcode | [error-codes.md § 36](error-codes.md) |
| `ResultCode: 12` (on send) | Initiator name/password wrong for B2C | [initiator-or-shortcode-mismatch.md](initiator-or-shortcode-mismatch.md) |

## Callbacks

| Signature | Meaning | Jump to |
|---|---|---|
| Callback never arrives | localhost URL, no HTTPS, firewall, or missing ACK | [callbacks.md](../concepts/callbacks.md) |
| Callback arrives but body is malformed | Body shape differs by API (STK vs B2C vs Status) | [callback-arrived-but-malformed.md](callback-arrived-but-malformed.md) |
| Callback says success but statement still pending | Race between callback delivery and settlement | [callback-arrived-but-pending.md](callback-arrived-but-pending.md) |
| B2C says success but recipient didn't receive | Wrong MSISDN, delayed SMS, or reversed before SMS | [b2c-success-but-recipient-not-received.md](b2c-success-but-recipient-not-received.md) |

## Duplicates & Idempotency

| Signature | Meaning | Jump to |
|---|---|---|
| `ResultCode: 35` | Duplicate transaction within 30s window | [error-codes.md § 35](error-codes.md) |
| `ResultCode: 43` | Duplicate MerchantRequestID — use `crypto.randomUUID()` | [idempotency-and-deduplication.md](../concepts/idempotency-and-deduplication.md) |
| `ResultCode: 34` | Processing delay — **do NOT retry** | [error-codes.md § 34](error-codes.md) |

## Provisioning & Go-Live

| Signature | Meaning | Jump to |
|---|---|---|
| `ResultCode: 32` | STK/API not activated on your shortcode | [error-codes.md § 32](error-codes.md) |
| `ResultCode: 33` | Go-live not approved — still sandbox-only | [going-live.md](../concepts/going-live.md) |
| "Works in sandbox, fails in prod" | Env-specific cert, credentials, or provisioning gap | [sandbox-vs-prod-divergence.md](sandbox-vs-prod-divergence.md) |

## Concepts Worth Knowing

| Confusion | Answer |
|---|---|
| `ResponseCode` vs `ResultCode` — what's the difference? | [resultcode-vs-responsecode.md](../concepts/resultcode-vs-responsecode.md) |
| How do I dedupe callbacks safely? | [idempotency-and-deduplication.md](../concepts/idempotency-and-deduplication.md) |
| What if the callback fires AND my polling returns at the same time? | [callback-vs-polling-race-conditions.md](../concepts/callback-vs-polling-race-conditions.md) |

---

## How to use this index

- **Paste a code into `daraja_diagnose`** — the tool auto-routes to the right doc.
- **Paste a full callback JSON** — `daraja_diagnose` parses it and extracts the ResultCode.
- **Paste a log line** — same. The tool handles `{"ResultCode": "35", ...}`, `ResultCode: 1032`, and raw HTTP error bodies.
- **Not sure where to start?** — call `daraja_explain` with the concept name (e.g., `"ResultCode"`, `"callbacks"`, `"going live"`).
