# STK Prompt Reached Phone, Customer Entered PIN, Still Fails

**Symptom:** The STK Push prompt appeared on the customer's phone. They entered their PIN. The payment still fails — but not with 1032 (cancelled) or 1037 (unreachable).

**What happened:** The prompt delivery and customer input worked. Something between "customer pressed Enter" and "transaction committed" rejected it.

---

## The five common causes

### 1. Insufficient balance (ResultCode 1)

The most common. Customer has less than the requested amount in their M-Pesa.

**Signal:** `ResultDesc` contains "insufficient" or "balance".

**Fix:** Show "Insufficient M-Pesa balance. Please top up and try again." Don't auto-retry.

### 2. Daily limit exceeded (ResultCode 8)

M-Pesa enforces per-customer daily transaction limits that vary by KYC tier. The customer has already spent today.

**Signal:** `ResultDesc` contains "limit" or "daily".

**Fix:** Show "Daily M-Pesa limit reached. Try again tomorrow or use a different payment method." Offer card/bank alternative if you have one.

### 3. Wrong PIN (ResultCode 2001)

Customer fat-fingered their PIN. After 3 wrong attempts, Safaricom locks further attempts for an hour.

**Signal:** `ResultDesc` contains "invalid" or "PIN" or the transaction stops with no further prompt.

**Fix:** "Wrong PIN entered. Try again — after 3 wrong attempts you'll need to wait an hour."

### 4. Prompt expired mid-entry (timeout)

STK prompts live for ~60 seconds. If the customer takes longer than that to enter their PIN, the prompt times out on the Safaricom side even though their phone still shows it.

**Signal:** `ResultCode: 1032` or `1037` or a silent pending → polling-timeout outcome. The customer insists they entered the PIN.

**Fix:** Show a countdown timer in your UI. When polling times out, offer "Didn't get the prompt? Tap Retry." Use `mpesa.collect({ ..., pollTimeout: 90000 })` to extend the wait to 90 seconds.

### 5. Transaction amount mismatch

Rare but real — the customer's PIN authorises their phone, but the amount in the prompt differs from what your server expected (UI showed KES 100, request sent KES 1000 due to a rounding bug).

**Signal:** `ResultCode: 0` in the callback with a `MpesaReceiptNumber` for an amount different from your intended charge.

**Fix:** Validate the callback amount against your expected amount before marking the order paid.

```js
const paid = cb.CallbackMetadata.Item.find(i => i.Name === 'Amount').Value;
if (paid !== expectedAmount) {
  // Log discrepancy, refund, raise internal alert
  console.error('[stk] amount mismatch:', { paid, expectedAmount });
}
```

---

## Decision tree

**Step 1 — What's the ResultCode?**

- `1` → Insufficient balance (case 1)
- `8` → Daily limit (case 2)
- `2001` → Wrong PIN (case 3)
- `1032` → Cancelled or timed out (case 4)
- `0` but callback Amount differs from your request → case 5
- Something else → use `daraja_diagnose` with the callback body

**Step 2 — Confirm with the customer.**

The customer has context you don't. "Did you see the prompt?" "How many digits did you type?" "Did the 'Enter M-Pesa PIN' message change?" Friendly questions resolve 80% of cases.

**Step 3 — If you can't identify the cause:**

- Log `MerchantRequestID`, `CheckoutRequestID`, the full `ResultDesc`, and the customer's phone number (masked in logs — the SDK helps with this).
- Escalate to Safaricom support with those identifiers.

---

## Prevention

- **Show the amount prominently in your UI before initiating STK.** Customers tap decline when the prompt amount doesn't match their expectation.
- **Use `mpesa.collect()`** — its polling handles the prompt-timeout edge case.
- **Validate callback Amount matches request Amount.** Catches silent rounding bugs.
- **Surface `err.suggestion` and `err.prevention`** — both are populated on every `MpesaError`. The suggestion is what to tell the customer; the prevention is what to fix in code.

---

## Related

- [Error Codes reference](error-codes.md)
- [Troubleshooting decision trees](troubleshooting.md)
- [Top 20 Errors Index](top-20-index.md)
