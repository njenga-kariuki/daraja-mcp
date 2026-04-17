# Callback vs Polling Race Conditions

> For STK Push, Daraja posts the callback to your URL AND the SDK polls status via `stkPushQuery`. What happens if both resolve at the same time?

This is the race condition that breaks custom integrations in production traffic. If you don't handle it explicitly, you'll mark some orders paid twice and mark others mysteriously cancelled.

---

## The two sources of truth

### Source A — Callback (push)

Daraja POSTs to your `/callback` URL once the transaction completes (or times out). The callback arrives with `ResultCode`, the receipt, and metadata. For STK, this happens 5-60 seconds after the prompt.

### Source B — Status polling (pull)

The SDK calls `stkPushQuery` every ~2 seconds with the `CheckoutRequestID`. When the query returns a terminal state (completed, cancelled, timed out), the SDK resolves the `mpesa.collect()` promise.

Both sources carry the authoritative `ResultCode`. The question is — which one do you trust, and how do you prevent double-processing?

---

## The canonical race

1. **t=0** — Customer enters PIN on phone. M-Pesa commits.
2. **t=0.3s** — Daraja fires callback POST to your URL.
3. **t=0.4s** — Callback arrives at your server, your handler starts processing.
4. **t=1.5s** — SDK's 2-second `stkPushQuery` poll fires.
5. **t=1.7s** — Status query returns `ResultCode: 0`.
6. **t=1.8s** — `mpesa.collect()` promise resolves with status `completed`.
7. **t=2.0s** — Your app's caller of `mpesa.collect()` runs "mark order paid" logic.
8. **t=2.1s** — Your callback handler also runs "mark order paid" logic.
9. **Double-process.** Same receipt, same amount, processed twice.

---

## The five ways to handle it

### Strategy 1 — Trust the SDK, ignore the callback for STK

**Recommended for most apps using `@daraja-kit/sdk`.**

For STK Push, the SDK's auto-polling returns the full outcome synchronously from `mpesa.collect()`. You don't need a callback at all for collect. Don't configure one:

```js
const result = await mpesa.collect({ amount: 100, phone });
// result is the authoritative outcome — mark order paid here.
```

If you haven't registered a callback URL with Daraja, the callback POST goes nowhere. No race. No handler. No problem.

This is the default path and it's why the SDK exists.

### Strategy 2 — Trust the callback, drop polling updates for STK

If you configured a callback URL (maybe for another purpose, or because you inherited the setup), make the callback the source of truth and ignore the synchronous SDK result for DB updates:

```js
// Don't update DB here — wait for callback
await mpesa.collect({ amount, phone, callbackUrl: '...' });

// In the callback handler:
app.post('/callback', express.json(), (req, res) => {
  const cb = req.body.Body.stkCallback;
  if (cb.ResultCode === 0) {
    db.markPaid(cb.CheckoutRequestID, cb);
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
```

The SDK result becomes UI-only ("payment in progress"); the callback is the commit.

### Strategy 3 — Both update, idempotent on transaction ID

The most resilient. Both the callback handler AND the code after `await mpesa.collect()` run `db.markPaid()`, but `markPaid` is idempotent:

```js
async function markPaid(checkoutRequestID, data) {
  try {
    await db.payments.insert({
      checkout_request_id: checkoutRequestID,
      receipt: data.receipt,
      amount: data.amount,
      status: 'paid',
    });
    // First writer wins — trigger downstream effects here
    await sendReceiptEmail(data);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      // Already processed by the other source — skip downstream effects
      return;
    }
    throw err;
  }
}
```

Unique DB index on `checkout_request_id` makes second write a no-op. Works as long as both sources carry the same ID — which they do.

### Strategy 4 — First-wins with in-memory guard

Lighter than DB-level but requires process affinity:

```js
const processed = new Set();
function markPaidOnce(id, data) {
  if (processed.has(id)) return;
  processed.add(id);
  // ... actual DB update ...
}
```

Works for single-instance servers. For multi-instance, use Redis:

```js
const firstWrite = await redis.set(`paid:${id}`, '1', 'NX', 'EX', 3600);
if (!firstWrite) return; // someone else already claimed
// ... actual DB update ...
```

### Strategy 5 — Only callback, no polling (raw API users)

If you're not using the SDK and you've configured a callback, the race doesn't exist because you're not polling. Callback is your only source.

The tradeoff: callbacks require a public HTTPS endpoint that you maintain. The SDK's auto-polling is less fragile.

---

## Which strategy should you pick?

| Situation | Strategy |
|---|---|
| New integration, using SDK | **1** — Trust the SDK, don't configure a callback for collect |
| Migrating from raw Daraja, callback already wired | **3** — Idempotent both, DB unique constraint |
| Multi-instance production | **3** (DB idempotency) or **4** (Redis first-wins) |
| Serverless / edge-deployed | **1** (SDK polling only) — avoids callback URL complexity |
| High-volume B2C (thousands/day) | **3** + daily reconciliation job against Safaricom statement |

---

## Other race conditions to know

### Callback retries

Daraja retries callbacks up to 3 times over a few minutes if your ACK is slow. Your handler MUST be idempotent ([see idempotency doc](idempotency-and-deduplication.md)). Not a race per se, but the same "double-process" failure mode.

### Polling timeout + late callback

Your polling hits `pollTimeout` (default 60s in the SDK) and resolves the promise with `status: 'timeout'`. Two minutes later, the customer finally enters their PIN and Daraja posts a success callback. Now your UI says "timed out" but your callback handler says "paid". Strategy 3 (idempotent) handles this — the late callback updates the DB record from "timeout" to "paid". Strategy 1 alone misses this — configure a callback or accept that late completions are out-of-scope.

### STK Query race with callback

Rare. Your manual `mpesa.status()` call fires at the same time the callback arrives. Same resolution as the main race — idempotent DB writes prevent double-processing.

---

## Prevention

- **Default to Strategy 1.** The SDK is built to handle this correctly. Don't introduce a callback for collect unless you have a specific reason.
- **When you need a callback, use Strategy 3.** Make the DB unique constraint your ultimate guardrail.
- **Never assume single-instance.** Write idempotent handlers from day one. Horizontal scaling catches you sooner than you think.
- **Log both sources.** When a customer disputes, you want to see "SDK resolved at T1, callback arrived at T2" for your own sanity.

---

## Related

- [Idempotency and Deduplication](idempotency-and-deduplication.md)
- [Callbacks](callbacks.md)
- [Callback Arrived But Pending](../errors/callback-arrived-but-pending.md)
- [ResultCode vs ResponseCode](resultcode-vs-responsecode.md)
