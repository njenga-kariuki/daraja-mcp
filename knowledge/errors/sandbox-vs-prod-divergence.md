# "It Works in Sandbox, Fails in Production" — Divergence Checklist

**Symptom:** Your code passed every sandbox test. You flipped the environment flag to production. It immediately fails — different error, different symptom, different cause.

**What happened:** Sandbox and production are separate systems with separate credentials, separate certificates, separate shortcodes, and different operational behaviors. Anything that is environment-specific is a divergence candidate.

---

## The eight known divergences

### 1. Different credentials, obviously

Consumer key, consumer secret, passkey, initiator name, initiator password, SecurityCredential — all different between sandbox and production. If any production value is missing or stale, it fails.

**Fix:** Use separate env files (`.env.sandbox`, `.env.production`) and load the right one based on `NODE_ENV`. Never hand-copy credentials.

### 2. Different certificates for SecurityCredential

Sandbox uses `SandboxCertificate.cer`. Production uses `ProductionCertificate.cer`. They are **different public keys**. SecurityCredential encrypted with the wrong cert decrypts to gibberish on the other side.

**Signal:** B2C, Balance, or Reversal returns `500.001.1001` or "invalid initiator information".

**Fix:** Let the SDK select the cert via `createClient({ environment: 'production' })`. Never inline a cert path.

### 3. Different shortcodes for B2C

Sandbox B2C uses `600999`. Production uses your actual business paybill. If you hardcoded `600999`, production fails silently.

**Fix:** Use the SDK (it handles this). If calling raw, move the shortcode to `.env` and read it per-environment.

### 4. STK Push delivery reliability

Sandbox routes STK to the Daraja test endpoint — which is occasionally flaky. Production routes through the real Safaricom GSM signalling network — which is reliable but subject to national network conditions.

**Signal:** Sandbox returns 1037 intermittently; production returns 1032 or succeeds cleanly. Sandbox retries "randomly" help; production retries don't.

**Fix:** Do not tune retry policies based on sandbox flakiness — it's not representative of production behavior. Use `knowledge/patterns/resilience.md` defaults.

### 5. Provisioning gaps — STK/B2C not enabled on your shortcode

When you go live, Safaricom provisions specific APIs on your production shortcode. STK Push, B2C, Status, and Balance are each enabled separately. If your go-live application only requested STK, calling B2C in production returns ResultCode 32 ("service not activated") even though sandbox works fine.

**Signal:** `ResultCode: 32` in production only. Sandbox accepts every API.

**Fix:** Email `apisupport@safaricom.co.ke` with your shortcode and the specific APIs you need enabled. Allow 3-7 business days.

### 6. Go-live not approved yet

You updated your config to production but Safaricom hasn't signed off on the go-live application.

**Signal:** `ResultCode: 33` ("go-live not approved").

**Fix:** Check your email for the Safaricom go-live approval. Until it arrives, keep `environment: 'sandbox'` in your production deploy and use feature flags to gate the real flip.

### 7. Rate limits

Sandbox has generous rate limits on the shared test credentials. Production has per-app rate limits based on your go-live tier. Aggressive polling that works in sandbox can trigger 429 in production.

**Signal:** `HTTP 429 Too Many Requests` in production only.

**Fix:** Implement exponential backoff; the SDK already does this for STK polling. If hitting 429 on other APIs, reduce concurrency or batch requests.

### 8. Callback URL behavior

Sandbox callbacks from Daraja originate from a fixed test IP range. Production callbacks come from Safaricom's production GNN IP range — a different set of addresses. If your firewall or IP-allowlist logic was built against sandbox IPs, production callbacks never arrive.

**Signal:** Callbacks fire in sandbox but not production. Your server logs show no POST hitting `/callback` in production.

**Fix:** Update your allowlist to the Safaricom production IP range. The SDK's `verifyCallback()` maintains this list automatically.

---

## Decision tree

**Step 1 — Did this ever work in production?**

- Never — you haven't gone live. Check case 6 first (go-live approval).
- Yes, and it broke — check case 7 (rate limits) and case 8 (callback IPs). Recent credential rotation? Check cases 1-3.

**Step 2 — Which API is failing?**

- Collect (STK Push) → case 1 (passkey), case 4 (delivery), case 5 (STK not enabled)
- Send (B2C) → case 2 (cert), case 3 (shortcode), case 5 (B2C not enabled)
- Status/Balance/Reversal → case 2 (cert), case 5 (API not enabled)

**Step 3 — Run `daraja_preflight` against both envs.**

```bash
daraja_preflight --env=sandbox
daraja_preflight --env=production
```

The tool catches credential mismatches, missing enablement, and unreachable callbacks. Compare the two reports side by side.

---

## Prevention

- **Never deploy production before `daraja_preflight --env=production` passes.** Add it to your CI.
- **Keep sandbox and production as separate apps in your config loader.** Never conditional-import based on env. `require('./config/' + env + '.js')` is a bug magnet; use explicit imports.
- **Document the enablement matrix.** What APIs are enabled on your production shortcode? When were they enabled? Who approved? Store this with your credentials doc.
- **Do a "first-hour" check after every production deploy.** Hit collect + send + status + balance. Log results. Catches cases 5 and 6 before a customer does.
- **When in doubt, check the Daraja portal.** The "My Apps" page shows enabled APIs per credential. Ground truth.

---

## Related

- [Going Live](../concepts/going-live.md)
- [Environments](../concepts/environments.md)
- [Authentication](../concepts/authentication.md)
- [Initiator or Shortcode Mismatch](initiator-or-shortcode-mismatch.md)
- [Top 20 Errors Index](top-20-index.md)
