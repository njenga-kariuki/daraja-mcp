# Troubleshooting

Decision trees for common Daraja integration issues. Start with the symptom, follow the path to the fix.

---

## STK Push Returns 1032 (User Cancelled)

**Symptom:** `mpesa.collect()` returns `{ status: 'failed', errorCode: '1032' }`.

**What happened:** The customer saw the STK Push prompt on their phone and either pressed Cancel or dismissed it.

**Fix:**
1. This is normal user behavior, not a bug.
2. Show a friendly message: "Payment cancelled. Tap Pay to try again."
3. Allow the user to re-initiate payment.
4. Do not auto-retry -- the user intentionally cancelled.

**If it happens frequently:**
- Ensure your merchant name and amount are clear on the prompt.
- Check that the amount matches what the user expects.
- Consider adding a confirmation step before initiating STK Push.

---

## STK Push Returns 1037 (Phone Unreachable)

**Symptom:** `mpesa.collect()` returns `{ status: 'failed', errorCode: '1037' }`.

**What happened:** Daraja could not deliver the STK prompt to the customer's phone.

**Common causes:**
- Phone is powered off
- Phone is in airplane mode
- No cellular signal
- iOS eSIM issue (common with newer iPhones)
- Phone number is not registered on M-Pesa

**Fix:**
1. Ask the customer: "We couldn't reach your phone. Please check it's on and has signal."
2. **For iOS users specifically:** Restarting the phone often resolves eSIM connectivity issues with M-Pesa.
3. Wait 10-30 seconds, then offer to retry.
4. If it persists, the phone may genuinely be off or out of range.

---

## STK Push Never Completes (Stays Pending)

**Symptom:** `mpesa.collect()` returns `{ status: 'pending' }` after the full timeout period.

**What happened:** The STK prompt was sent but the customer never acted on it, or a USSD session is blocking it.

**Common causes:**
- Customer did not see the prompt (phone was locked, app in foreground)
- Active USSD session is blocking the STK prompt (error 1001)
- Customer is ignoring the prompt
- Sandbox flakiness

**Fix:**
1. Ask the customer to check their phone for an M-Pesa prompt.
2. If they have an active USSD session (`*334#` or similar), ask them to cancel it.
3. Wait 2-3 minutes for the USSD session to time out naturally.
4. Retry the payment.
5. Increase `pollTimeout` if you want to wait longer (e.g., 90000ms).

---

## B2C Fails with SecurityCredential Error

**Symptom:** `mpesa.send()` throws an error about SecurityCredential, or the API returns error 2001.

**What happened:** The RSA-encrypted initiator password is invalid.

**Check these in order:**

1. **Wrong certificate for environment?**
   - Sandbox must use `SandboxCertificate.cer`
   - Production must use `ProductionCertificate.cer`
   - The SDK selects the correct cert automatically based on environment.

2. **Wrong initiator password?**
   - Sandbox: password is `Safaricom999!*!`
   - Production: use the password Safaricom emailed you during go-live

3. **Wrong initiator name?**
   - Sandbox: initiator is `testapi`
   - Production: use the initiator name from your go-live credentials

4. **Corrupted certificate file?**
   - Re-download the certificate from the developer portal.
   - Ensure the file is not truncated or modified.

---

## OAuth Returns 401 or 403

**Symptom:** Token generation fails with HTTP 401 (Unauthorized) or 403 (Forbidden).

**For 401 (Invalid Credentials):**
1. Verify your consumer key and secret are correct. Copy-paste from the portal to avoid typos.
2. Check you are using the right credentials for the right environment (sandbox vs production).
3. Regenerate credentials on the developer portal and try again.
4. Ensure there are no extra spaces or newlines in your environment variables.

**For 403 (Access Denied):**
1. Check that your app has the required APIs enabled on the developer portal.
2. Go to My Apps, select your app, and verify the API checkboxes.
3. For production: your go-live approval may not cover all APIs you need. Contact Safaricom.

---

## Callbacks Never Arrive

**Symptom:** You initiate a B2C, Status, Balance, or Reversal request successfully (get `responseCode: '0'`), but the callback never hits your server.

**Check these in order:**

1. **Is your server running?**
   - Check that your Express (or other) server is actually listening on the expected port.

2. **Is the URL reachable from the internet?**
   - Test: `curl -X POST https://your-callback-url.com/api/b2c/callback -d '{}'`
   - If using ngrok: is the ngrok tunnel still active? The URL changes on restart.

3. **Is it HTTPS?**
   - Daraja requires HTTPS. HTTP URLs will be silently ignored.

4. **Is the SSL certificate valid?**
   - Self-signed certs will not work. Use Let's Encrypt or a real CA.

5. **Is there a firewall blocking inbound requests?**
   - Check cloud provider security groups, firewall rules, or WAF settings.
   - Safaricom IPs must be able to reach your server.

6. **Are you returning the correct response?**
   - Your endpoint must return `{ ResultCode: 0, ResultDesc: "Accepted" }`.
   - If you return an error, Daraja may stop sending callbacks.

7. **Sandbox-specific:**
   - Sandbox callbacks can be delayed by minutes or occasionally not delivered at all.
   - This is a known sandbox limitation. Test again.

---

## Amount Too Low or Too High

**Symptom:** Error codes 03 (below minimum) or 04 (above maximum).

**Limits:**

| API | Minimum | Maximum |
|-----|---------|---------|
| STK Push | KES 1 | KES 150,000 |
| B2C | KES 10 (sandbox) | KES 150,000 |
| B2B | Varies | Varies by agreement |

**Fix:**
1. Ensure `amount` is at least 1 (or 10 for B2C sandbox).
2. For large amounts, split into multiple transactions.
3. Production limits may differ from sandbox. Verify with Safaricom for your specific shortcode.

---

## Duplicate Transaction Error (Code 35)

**Symptom:** Error code 35 when retrying a payment.

**What happened:** You sent the same phone + amount combination too quickly. Daraja rejects it to prevent accidental double-charges.

**Fix:**
1. Wait at least 30 seconds before retrying the same phone + amount.
2. If intentionally charging the same amount twice, change the `reference` to make it unique.
3. Implement a cooldown in your UI to prevent rapid re-clicks of the Pay button.

```typescript
// Simple deduplication
const recentRequests = new Map<string, number>();

function canInitiatePayment(phone: string, amount: number): boolean {
  const key = `${phone}:${amount}`;
  const lastTime = recentRequests.get(key) || 0;
  const now = Date.now();

  if (now - lastTime < 30000) {
    return false; // Too soon -- wait 30 seconds
  }

  recentRequests.set(key, now);
  return true;
}
```

---

## Sandbox Returns Inconsistent Results

**Symptom:** Same request sometimes succeeds, sometimes fails, or returns unexpected data in sandbox.

**This is a known issue.** Safaricom's sandbox environment is not as stable as production. Common manifestations:
- Callbacks arrive late or not at all
- STK Push returns random errors
- Token generation is slow
- B2C returns different result structures

**Fix:**
1. Implement retries with exponential backoff in your test code.
2. Do not treat sandbox failures as bugs in your code unless you can reproduce them consistently.
3. Test critical flows multiple times to distinguish real bugs from sandbox flakiness.
4. When in doubt, verify your code is correct, then move to production testing with small amounts.

---

## "Invalid Access Token" After It Was Working

**Symptom:** API calls that were working suddenly return 401.

**What happened:** Your access token expired. Tokens last 3599 seconds (about 1 hour).

**Fix:**
- If using the SDK, this should not happen -- the SDK auto-refreshes tokens.
- If making raw API calls, implement token caching with refresh:

```typescript
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  const now = Date.now();

  // Refresh 60 seconds before expiry
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.token;
  }

  const token = await fetchNewToken(); // Your OAuth call
  cachedToken = {
    token,
    expiresAt: now + 3599 * 1000,
  };

  return token;
}
```

---

## Quick Reference: Error to Action

| Symptom | Most Likely Cause | First Action |
|---------|-------------------|--------------|
| 1032 | User cancelled | Show retry button |
| 1037 | Phone unreachable | Ask user to check phone, restart if iOS |
| 1001 | USSD session active | Wait 2-3 min, retry |
| 1025/9999 | Description too long | Shorten to 13 chars |
| 2001 | Wrong initiator credentials | Check cert + password + initiator name |
| 401 | Bad consumer key/secret | Regenerate on portal |
| 403 | API not enabled | Enable API on portal |
| No callback | URL not reachable | Test URL with curl, check ngrok |
| 35 | Duplicate transaction | Wait 30s before retry |
| 11/29 | Daraja system issue | Retry with backoff |
| pending | Prompt not acted on | Ask user to check phone |
