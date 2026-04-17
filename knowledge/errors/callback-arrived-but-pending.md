# Callback Arrived with ResultCode 0 But Transaction Still Shows Pending

**Symptom:** Your callback fired with `ResultCode: 0` (success). Your app marks the transaction as complete. But the M-Pesa statement, customer portal, or a status query still shows the transaction as pending or missing.

**What happened:** The callback represents Daraja's acknowledgement of the request — not the final settlement state. For most transactions these are the same moment. For a small minority, they diverge by seconds to minutes.

---

## The three common causes

### 1. Callback-to-settlement race

**Explanation:** Daraja completes the M-Pesa transaction on the rail, sends the callback to your URL, and updates internal settlement ledgers. For STK Push these are synchronous. For B2C and C2B they can lag by up to 30 seconds in sandbox, a few seconds in production.

**Signal:** Status query a minute later returns the final state (success or failure) matching the callback.

**Fix:** Trust the callback. Don't block your UI on the statement — it catches up. If you're displaying live balance, requery after 30-60 seconds.

### 2. B2C "SMS delay"

**Explanation:** For B2C, the callback fires when M-Pesa has committed the transaction to the recipient's wallet. The SMS notification to the recipient is a separate event that can lag by minutes during high load.

**Signal:** Recipient says "I didn't get the money" but your callback shows success. When they check the M-Pesa app directly, the balance is there.

**Fix:** Tell the customer to check M-Pesa app balance, not SMS. In your confirmation email/UI, include the `TransactionID` (MEH...) so they can verify on the Safaricom USSD `*334#`.

### 3. Sandbox-only clock skew

**Explanation:** Sandbox does not settle in real time. The callback lands, but the sandbox "statement" endpoint is backed by a slower test ledger.

**Signal:** Everything works in sandbox except status queries — they return pending for minutes after the callback.

**Fix:** Do not gate your integration tests on the sandbox statement. Test the callback path. When you move to production, settlement is real-time.

---

## Decision tree

**Step 1 — Query the transaction directly.**

```js
const status = await mpesa.status({ transactionId: 'QKJ41HAY4I' });
console.log(status); // authoritative
```

**Step 2 — Compare three sources:**
- Your DB (what you recorded from the callback)
- `mpesa.status()` result
- Safaricom merchant portal or `*334#` on the recipient's phone

**Step 3 — Match the pattern:**

| Callback | Status Query | Portal | Likely cause |
|---|---|---|---|
| Success | Success | Pending | Settlement lag — wait 30-60s |
| Success | Pending | Pending | Callback-to-settlement race — check again in 2 minutes |
| Success | Failed | Failed | **Bug** — callback lied; raise with Safaricom support |
| Success | Success | Missing | SMS/portal lag — fine, trust the call response |

**Step 4 — If after 5 minutes the portal still shows nothing:**

Contact Safaricom support with:
- Your `MerchantRequestID` + `CheckoutRequestID` (STK) or `OriginatorConversationID` + `ConversationID` (B2C/others)
- The full callback body
- Timestamp of the callback

---

## Do NOT

- Retry the transaction. The callback was truthful; the money moved. Retrying creates a duplicate (error 35).
- Show "failed" in your UI just because the portal lags.
- Block the customer's experience on the portal state.

---

## Prevention

- **Design for eventually-consistent settlement.** Your DB is the source of truth for your users, not the Safaricom portal. Accept the callback as final.
- **Log `MerchantRequestID` and `TransactionID` in every record.** When you need to reconcile with Safaricom support later, these are the keys.
- **Schedule a reconciliation job** — daily, compare your DB completed-transactions count against Safaricom statement exports. Flag mismatches for human review.
- **Do not surface "pending" status past 90 seconds.** If the callback hasn't arrived by then, treat it as failed and let the customer retry. Set this timeout on the SDK: `mpesa.collect({ ..., pollTimeout: 90000 })`.

---

## Related

- [Callback vs Polling Race Conditions](../concepts/callback-vs-polling-race-conditions.md)
- [Check Status](../capabilities/check-status.md)
- [Idempotency and Deduplication](../concepts/idempotency-and-deduplication.md)
