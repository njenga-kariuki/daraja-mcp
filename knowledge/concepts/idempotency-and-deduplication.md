# Idempotency and Deduplication

> If you retry, how do you make sure you don't charge the customer twice or pay a recipient twice? This is the single most important operational topic in an M-Pesa integration.

Daraja is already partly idempotent. The SDK adds a layer. You add the final layer. Get all three right and double-charges become impossible.

---

## What Daraja does for you

### `MerchantRequestID` (STK Push)

Daraja enforces a ~30-second uniqueness window on STK Push: the same phone + amount within 30 seconds returns `ResultCode: 35` (duplicate) on the second attempt. This is your cheapest guardrail.

### `OriginatorConversationID` (B2C / other async)

Same pattern for async APIs. You send an `OriginatorConversationID`; Daraja rejects any subsequent send with the same ID within a dedup window.

### `CheckoutRequestID` (returned for STK)

Returned in the synchronous STK response. Use this to query status later — it's the stable handle for the transaction.

---

## What the SDK does for you

- **Generates unique `MerchantRequestID` per call** using `crypto.randomUUID()`. No manual work needed; never pass a deterministic ID.
- **Tracks `CheckoutRequestID`** through the auto-polling flow so you don't rely on the caller to remember it.
- **`verifyCallback()` utility** includes an in-memory dedupe keyed by `ConversationID` / `CheckoutRequestID` to stop double-processing if Daraja retries the callback.

---

## What you still need to do

### 1. Dedupe at the request layer (before calling the API)

A rapid double-click on your UI's "Pay" button can fire two `mpesa.collect()` calls within milliseconds. Daraja's 30-second window catches this, but only on the second one — so the first one still goes through, and if the two have slightly different amounts, both succeed.

**Pattern — request-level dedupe:**

```js
const inFlight = new Map(); // key: userId+orderId, value: Promise
async function pay(userId, orderId, amount, phone) {
  const key = `${userId}:${orderId}`;
  if (inFlight.has(key)) return inFlight.get(key);
  const p = mpesa.collect({ amount, phone });
  inFlight.set(key, p);
  try {
    return await p;
  } finally {
    inFlight.delete(key);
  }
}
```

For distributed systems, back `inFlight` with Redis (TTL 60s, key includes request hash).

### 2. Dedupe at the callback layer

Daraja will retry the same callback up to three times over a few minutes if your ACK is slow or non-200. Your handler must be idempotent: processing the same transaction twice must be a no-op.

**Pattern — callback dedupe:**

```js
const processed = new Set(); // or Redis SET with TTL 24h
app.post('/callback', express.json(), (req, res) => {
  const id = req.body?.Body?.stkCallback?.CheckoutRequestID
          ?? req.body?.Result?.ConversationID;
  if (processed.has(id)) {
    return res.json({ ResultCode: 0, ResultDesc: 'Accepted (duplicate)' });
  }
  processed.add(id);
  // ... process transaction ...
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
```

Or use `verifyCallback()` which does this automatically:

```js
import { verifyCallback } from '@daraja-kit/sdk';

app.post('/callback', express.json(), (req, res) => {
  const verified = verifyCallback(req.body, { ip: req.ip });
  if (!verified.valid) return res.status(403).end();
  if (verified.duplicate) return res.json({ ResultCode: 0, ResultDesc: 'Accepted (dup)' });
  // ... process ...
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
```

### 3. Dedupe at the database layer

Your DB should have a unique constraint on `MpesaReceiptNumber` (or `TransactionID` for async APIs). If two callbacks somehow slip past your in-memory check, the DB refuses to insert the same receipt twice.

```sql
CREATE UNIQUE INDEX ux_mpesa_receipt ON payments(mpesa_receipt_number);
```

When the insert fails with a duplicate-key error, treat it as "already processed" and return success from your callback handler.

---

## Retry semantics by error code

| Error code | Retryable? | Unique ID strategy |
|---|---|---|
| `1032` (cancelled) | No — user action | New MerchantRequestID on user retry |
| `1037` (unreachable) | Yes, after 30s | **New** MerchantRequestID |
| `1001` (USSD busy) | Yes, after 2-3min | New MerchantRequestID |
| `05` / `11` / `29` (transient) | Yes, with backoff | **New** MerchantRequestID |
| `34` (processing delay) | **NO — do NOT retry.** Wait and query status. | N/A |
| `35` (duplicate) | No — already a duplicate | Wait 30s before any retry |
| `43` (duplicate MerchantRequestID) | Yes, but generate a **new** UUID | Never reuse IDs across retries |

**The critical rule:** every retry must have a new MerchantRequestID. The SDK does this automatically. If you're reusing IDs, you'll trip error 43.

---

## Code 34 deserves its own warning

```
ResultCode: 34 = Processing Delay
```

This is NOT failure. This is slow. If you retry on 34, Daraja processes both the original (eventually) and the retry — and the customer is charged twice. In production.

Exclude 34 from your retry policy:

```js
if (err.darajaCode === '34') {
  // Do NOT retry. Query status after 60s.
  return mpesa.status({ transactionId: originalId });
}
```

---

## The full pattern

Putting all three layers together:

```js
// Layer 1: in-flight dedupe
const key = `${userId}:${orderId}`;
if (inFlight.has(key)) return inFlight.get(key);

const p = mpesa.collect({ amount, phone });
inFlight.set(key, p);

try {
  const result = await p;

  // Layer 3: DB unique constraint
  try {
    await db.payments.insert({
      mpesa_receipt: result.receipt,
      user_id: userId,
      order_id: orderId,
      amount,
      status: result.status,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      // Already processed — safe to ignore
      return await db.payments.findByReceipt(result.receipt);
    }
    throw err;
  }

  return result;
} finally {
  inFlight.delete(key);
}

// Layer 2: callback dedupe is in verifyCallback() — separate handler
```

Three layers. Each covers a different failure mode. Together they make double-charging essentially impossible.

---

## Related

- [Error Codes § 35 (duplicate), § 43 (duplicate ID), § 34 (delay)](../errors/error-codes.md)
- [Callback vs Polling Race Conditions](callback-vs-polling-race-conditions.md)
- [Resilience patterns](../patterns/resilience.md)
- [Callbacks](callbacks.md)
