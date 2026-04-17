# Initiator or Shortcode Mismatch (403 / 2001 / "not authorized")

**Symptom:** B2C, Balance, or Reversal fails with 2001 (invalid initiator), 403 Forbidden, or a cryptic "not authorized for this API" message. Passkey and shortcode look correct.

**What happened:** There are three separate credentials involved (consumer key/secret, shortcode+passkey, initiator name+password), and B2C uses a fourth (SecurityCredential). One of them is wrong, or wrong for the environment, or the shortcode isn't provisioned for the API you're calling.

---

## The four credential layers

| Credential | What it authorises | Used by |
|---|---|---|
| Consumer Key + Consumer Secret | OAuth token generation (gets you in the door) | Every API |
| Shortcode + Passkey | Specific paybill / till for collection | STK Push, STK Query, C2B |
| Initiator Name + Initiator Password | Authorised user for outbound transactions | B2C, Status, Balance, Reversal |
| SecurityCredential (RSA-encrypted Initiator Password) | The wire format for Initiator Password | B2C, Status, Balance, Reversal |

STK Push uses the top two. B2C uses the top layer + the bottom two. Each layer has its own failure mode.

---

## The four common mismatches

### 1. Correct password, wrong initiator name

**Explanation:** You rotated the initiator password but kept the wrong name (e.g., "apiuser" instead of "testapi"). Or the sandbox name "testapi" in a production config.

**Signal:** ResultCode 2001 from a B2C call. Error message mentions "invalid credentials" or "initiator".

**Fix:**
- **Sandbox**: `MPESA_INITIATOR_NAME=testapi`, `MPESA_INITIATOR_PASSWORD=Safaricom999!*!`
- **Production**: the initiator name is set when you configured B2C at go-live — check your Safaricom welcome email or the portal's "API Users" section.

### 2. Right name + password, shortcode not authorized for this API

**Explanation:** Each shortcode is provisioned for specific APIs at Safaricom's side. Your collect shortcode (174379 in sandbox) does NOT have B2C permission. B2C uses a separate shortcode (600999 in sandbox).

**Signal:** 403 or a message containing "not authorized" / "not registered for this service". Happens specifically on B2C but collect works fine.

**Fix:**
- **Sandbox B2C**: use shortcode `600999` for B2C, `174379` for STK.
- **Production**: email `apisupport@safaricom.co.ke` to enable B2C on your shortcode if you haven't already.

```js
// Sandbox — separate shortcodes for collect vs send
const mpesa = createClient({
  environment: 'sandbox',
  // SDK handles the shortcode split automatically
});
await mpesa.collect({ amount: 100, phone: '0712345678' });          // uses 174379
await mpesa.send({ amount: 1000, phone: '0712345678', callbackUrl }); // uses 600999
```

### 3. Passkey from the wrong environment

**Explanation:** Sandbox passkey (`bfb279f9aa...`) was accidentally copied to production config, or vice versa. Passkeys are environment-specific.

**Signal:** STK Push fails with ResultCode 36 or 42 (passkey mismatch) in production. In sandbox, it fails the same way if you used the prod passkey.

**Fix:**
- Sandbox: use the SDK default (`createClient({ environment: 'sandbox' })` auto-loads the sandbox passkey). Don't override.
- Production: the passkey is emailed to you at go-live. Store in `MPESA_PASSKEY` env var.

### 4. SecurityCredential generated against wrong cert

**Explanation:** SecurityCredential is the Initiator Password RSA-encrypted with the Safaricom public key certificate. Sandbox and production have **different certificates**. Using one cert's SecurityCredential with the other environment fails.

**Signal:** ResultCode `500.001.1001` or a generic 500 on B2C. "Invalid initiator information" in the description.

**Fix:** Let the SDK handle this — `createClient({ environment })` picks the right cert automatically. If you're doing it manually:

- Sandbox cert: `SandboxCertificate.cer` (the SDK bundles this)
- Production cert: `ProductionCertificate.cer` (download from the Daraja portal at go-live)

---

## Decision tree

**Step 1 — Which API failed?**

- STK Push (collect) → cases 1 or 3 (passkey/shortcode)
- B2C (send), Balance, Reversal → cases 1, 2, or 4 (initiator/cert)

**Step 2 — What's the error code?**

| Code | Most likely cause |
|---|---|
| `2001` | Initiator name/password wrong (case 1) |
| `36` or `42` | Passkey/shortcode mismatch (case 3) |
| `500.001.1001` | SecurityCredential cert wrong (case 4) |
| 403 Forbidden or "not authorized" | Shortcode not provisioned for this API (case 2) |

**Step 3 — Test with sandbox defaults.**

If you're unsure, reset to sandbox defaults and verify the code path works:

```js
const mpesa = createClient({ environment: 'sandbox' });
// No env vars — SDK uses built-in sandbox credentials
await mpesa.send({ amount: 100, phone: '254708374149', callbackUrl: 'https://example.com/cb' });
```

If that succeeds, your code is correct and only the production credentials are misconfigured.

**Step 4 — Run `daraja_preflight`.**

```bash
daraja_preflight --env=production
```

It fetches an OAuth token, probes your callback URL, and reports which credentials work.

---

## Prevention

- **One env per `.env` file.** Don't share `MPESA_*` vars between sandbox and production.
- **Let the SDK pick certs and shortcodes.** `createClient({ environment })` handles the split. Never hand-encrypt SecurityCredential in your code.
- **Document your shortcode-to-API matrix** as a go-live artifact. Which shortcode is enabled for STK? For B2C? For Balance?
- **Use `daraja_preflight` in CI/CD** — runs before every deploy; catches credential drift.
- **Rotate credentials through the portal, not manually.** Portal rotations update all dependent fields atomically.

---

## Related

- [Authentication](../concepts/authentication.md)
- [Environments](../concepts/environments.md)
- [Going Live](../concepts/going-live.md)
- [Sandbox vs Prod Divergence](sandbox-vs-prod-divergence.md)
- [Top 20 Errors Index](top-20-index.md)
