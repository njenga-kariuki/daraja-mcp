# Security & Trust

How the Daraja 4.0 SDK keeps M-Pesa integrations secure — and what you handle.

---

## What the SDK Handles for You (Zero-Config)

These security features are built into the SDK. You get them automatically by using `createClient()` and the SDK methods.

| Security concern | How the SDK handles it |
|---|---|
| **OAuth token management** | Auto-fetched, cached, refreshed 60s before expiry. Never stored on disk. |
| **Certificate encryption** | RSA-PKCS1 v1.5 encryption of SecurityCredential using Safaricom's public cert (bundled for sandbox). |
| **Phone normalization** | Any Kenyan format (0712..., +254712..., 254712...) → 254XXXXXXXXX. Invalid formats throw `ValidationError`. |
| **Amount validation** | Rejects decimals, zero, and negative values. Field truncation for AccountReference (12) and TransactionDesc (13). |
| **Sandbox isolation** | Production requires explicit credentials — throws `AuthError` if missing. No real money moves in sandbox. |
| **STK Push confirmation** | Customer enters M-Pesa PIN on their phone — human-in-the-loop for every payment. No silent charges. |
| **Self-healing errors** | Every error includes `.suggestion` (what to do now) and `.prevention` (how to avoid it next time). |
| **MCP tool scoping** | Agent tools are annotated: read-only tools run freely, payment tools require human confirmation. |
| **PII sanitization** | Phone numbers are masked (254708\*\*\*149) in MCP tool outputs before entering AI agent context. |

---

## What You Handle

These require your action — but the SDK provides utilities to make each one simple.

### Callback Verification (for B2C, Status, Balance, Reversal)

STK Push does **not** need callbacks (the SDK polls automatically). For APIs that do:

```typescript
import { verifyCallback } from '@daraja-kit/sdk';

app.post('/api/callback', (req, res) => {
  const result = verifyCallback(req.body, { ip: req.ip });
  if (!result.valid) return res.status(403).end();
  if (result.duplicate) return res.json({ ResultCode: 0, ResultDesc: 'Already processed' });

  // Verified, deduplicated, from Safaricom IP
  processPayment(result.data);
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
```

`verifyCallback()` handles IP whitelisting (Safaricom production IPs) and idempotency tracking with zero configuration.

> **Note:** Daraja does not sign callbacks with HMAC. IP whitelisting + idempotency is the standard mitigation.

### Credential Storage

- Store `DARAJA_CONSUMER_KEY` and `DARAJA_CONSUMER_SECRET` in environment variables
- Never commit credentials to source control
- The SDK reads from env vars automatically — no code needed

### HTTPS for Callbacks

Daraja requires callback URLs to use HTTPS with a valid SSL certificate. For local development, use `npx ngrok http 3000`.

---

## If Your Credentials Are Compromised

1. **Revoke** — Log into developer.safaricom.co.ke → My Apps → regenerate consumer key/secret
2. **Rotate** — Update environment variables with new credentials, redeploy
3. **Audit** — Check M-Pesa transaction logs for unauthorized activity
4. **Notify** — Contact Safaricom developer support if unauthorized transactions occurred

---

## M-Pesa's Structural Security Advantages

M-Pesa is inherently more secure for AI agent commerce than card-based payments:

| Property | M-Pesa (Daraja 4.0) | Card Payments |
|---|---|---|
| **Payment confirmation** | Customer enters PIN on phone (human-in-the-loop) | Agent can charge silently with card-on-file |
| **Device factor** | Requires physical SIM in registered phone | Card number alone is sufficient |
| **Fraud detection** | Safaricom GNN models (89% F1 on social engineering) | Varies by processor |
| **Blast radius** | Per-transaction limits (KES 150,000 STK Push) | Credit limit (can be much higher) |
| **Reversibility** | Explicit reversal API with callback confirmation | Chargebacks (slow, adversarial) |

---

## Developer Feedback: What We Collect

Daraja 4.0 ships a `daraja_feedback` MCP tool so developers (and their agents) can submit bug reports, feature requests, documentation gaps, and experience feedback in-flow. Feedback is **user-initiated and opt-in** — nothing is sent unless you explicitly invoke the tool. The same data flow backs `POST /api/feedback` for clients not using MCP.

### Fields stored per submission

| Field | Source | Notes |
|---|---|---|
| `reference` | generated | Short random ID returned to the submitter (e.g. `fb_7f2e91a0`) |
| `timestamp` | generated | ISO 8601 UTC |
| `category` | submitter | `bug` / `feature` / `docs` / `experience` / `other` |
| `message` | submitter | Free-text, max 2000 chars. **Sanitized** before write: phone numbers → `254708***149`, `consumerKey`/`consumerSecret`/`password` values → `***` |
| `context.lastTool` | submitter (optional) | Name of the Daraja tool the feedback is about, sanitized |
| `context.lastError` | submitter (optional) | Error message or code, sanitized |
| `source` | derived | `mcp` when submitted via the tool, `http` when submitted via the REST endpoint |

### What we do **not** collect

- No environment variables, file paths, file contents, or command strings
- No OAuth tokens, consumer keys, or any cached credentials
- No IP address or user-agent in the stored payload
- No linkage to a specific Daraja account or MSISDN (unless the submitter types one in free-text, in which case it is masked before storage)

### Where it goes

Each submission is:
1. Appended to a structured stderr audit line (same `emitAudit()` channel that logs every other MCP tool call).
2. Persisted to `feedback.jsonl` on the hosted server (rotates at 10 MB).
3. Held in an in-memory ring buffer of the last 200 submissions, visible at `/admin/feedback` to the Daraja team (requires `DARAJA_ADMIN_TOKEN`).

No third-party analytics platform, no ad network, no Safaricom internal CRM. The data stays on the daraja-kit server.

### Retention

- JSONL file rotates at 10 MB. Rotated files are retained until the Daraja team triages them, then deleted.
- Ring buffer is cleared on server restart.
- Individual submissions can be removed on request — email the address listed at [developer.safaricom.co.ke](https://developer.safaricom.co.ke) with the reference ID.

---

## Compliance Quick Reference

| Regulation | What it means for your integration |
|---|---|
| **Kenya Data Protection Act (2019)** | Phone numbers and transaction data are personal data. Minimize collection, secure storage, define retention periods. |
| **KYC/AML (CBK Guidelines)** | M-Pesa handles KYC at the platform level. Your app does not need separate KYC for standard STK Push payments. |
| **PCI DSS 4.0** | Not directly applicable (no card data), but AI principles apply: use tokens, log operations, maintain human oversight. |
