# Callback Arrived But Body Is Malformed

**Symptom:** A POST request hits your callback endpoint from Daraja, but the body is unparseable, missing `Body.stkCallback`, or contains fields you don't expect.

**What happened:** Daraja sends differently-shaped callback bodies for each API. STK Push, B2C, Status, Balance, and Reversal each use a distinct top-level envelope. If your parser assumes a single shape, any other API's callback looks "malformed."

---

## The five callback shapes

### 1. STK Push (collect)

Arrives at the callback URL you passed to `mpesa.collect()` (if you pass one; the SDK also polls automatically so you don't need it for collect).

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_191220191020363925",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 100 },
          { "Name": "MpesaReceiptNumber", "Value": "QKJ41HAY4I" },
          { "Name": "PhoneNumber", "Value": 254708374149 }
        ]
      }
    }
  }
}
```

### 2. B2C, Status, Balance, Reversal (async result callback)

```json
{
  "Result": {
    "ResultType": 0,
    "ResultCode": 0,
    "ResultDesc": "The service request is processed successfully.",
    "OriginatorConversationID": "1234-...",
    "ConversationID": "AG_...",
    "TransactionID": "MEH...",
    "ResultParameters": {
      "ResultParameter": [
        { "Key": "TransactionAmount", "Value": 1000 },
        { "Key": "TransactionReceipt", "Value": "MEH..." }
      ]
    },
    "ReferenceData": {
      "ReferenceItem": { "Key": "QueueTimeoutURL", "Value": "https://..." }
    }
  }
}
```

### 3. Timeout URL (all async APIs)

Same shape as above but `ResultCode != 0` and `ResultDesc` starts with "Request timeout...". Daraja posts this to your `QueueTimeoutURL` when the operation never completed. Handle it exactly like a failed result.

### 4. C2B validation (when you've registered validation URL)

```json
{
  "TransactionType": "Pay Bill",
  "TransID": "NEF61H8J60",
  "TransTime": "20230820142105",
  "TransAmount": "100.00",
  "BusinessShortCode": "600123",
  "BillRefNumber": "USER_123",
  "MSISDN": "254708374149"
}
```

No `Body` or `Result` wrapper. Respond with `{"ResultCode": 0, "ResultDesc": "Accepted"}` to accept, or `{"ResultCode": "C2B00011", "ResultDesc": "Rejected"}` to reject.

### 5. C2B confirmation

Same body shape as validation but fires after the transaction is already committed. You cannot reject it — respond with `{"ResultCode": 0, "ResultDesc": "Accepted"}` regardless.

---

## Decision tree

**Step 1 — What did your server actually receive?**

Log the raw body before parsing:

```js
app.post('/callback', express.json(), (req, res) => {
  console.log('[callback] raw body:', JSON.stringify(req.body));
  // ...
});
```

**Step 2 — Which envelope is it?**

- `body.Body.stkCallback` → STK Push callback (case 1)
- `body.Result` → Async result callback (case 2 or 3)
- `body.TransactionType && body.TransID` → C2B (case 4 or 5)
- None of the above → see Step 4

**Step 3 — Parse the right envelope.**

Use one handler per shape, or a discriminator:

```js
function parseCallback(body) {
  if (body?.Body?.stkCallback) return { kind: 'stk', data: body.Body.stkCallback };
  if (body?.Result) return { kind: 'async', data: body.Result };
  if (body?.TransactionType) return { kind: 'c2b', data: body };
  return { kind: 'unknown', data: body };
}
```

**Step 4 — The body is unexpected. What could it be?**

- **Empty body** — your server received the POST but `req.body` is `{}`. Add `express.json()` middleware. For very large bodies, increase the limit: `express.json({ limit: '1mb' })`.
- **Body is a string, not an object** — your parser ran before JSON parsing. Swap to the JSON middleware.
- **Body has no recognisable envelope** — check if this is an echo test from a third-party monitoring tool, or a misconfigured webhook from a different service pointing at the same URL.

---

## Always respond with an ACK

Every callback handler — regardless of the shape — must respond with `{"ResultCode": 0, "ResultDesc": "Accepted"}` and HTTP 200. Daraja retries non-2xx responses.

```js
app.post('/callback', express.json(), (req, res) => {
  try {
    // ... your processing ...
  } catch (err) {
    console.error('[callback] processing error:', err);
    // Still return 200 + Accepted so Daraja doesn't retry an unrecoverable error
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
```

If you throw an exception or respond with 5xx, Daraja will retry the callback up to three times over the next few minutes. Your code will then process the same transaction repeatedly — which is why [idempotency](../concepts/idempotency-and-deduplication.md) matters.

---

## Prevention

- **Write a discriminator function** — one place that identifies the envelope and routes to the right handler. No ad-hoc `body.Body.stkCallback.ResultCode` access scattered through your code.
- **Use the SDK's `verifyCallback()`** — it handles envelope detection, IP verification, and idempotency in one call.
- **Store the raw body** — log the first 200 chars of every callback before parsing. When a new shape shows up, you have the evidence.
- **Per-API callback URL** — give STK, B2C, Status, Balance, and Reversal each their own URL (`/callback/stk`, `/callback/b2c`, etc). Different handlers, no runtime branching.

---

## Related

- [Callbacks (concept)](../concepts/callbacks.md)
- [Idempotency and Deduplication](../concepts/idempotency-and-deduplication.md)
- [Callback vs Polling Race Conditions](../concepts/callback-vs-polling-race-conditions.md)
- [Top 20 Errors Index](top-20-index.md)
