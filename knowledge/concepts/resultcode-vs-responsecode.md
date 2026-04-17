# ResultCode vs ResponseCode

> Confusion signature: "`ResponseCode: 0` said success but my customer wasn't charged" or "`ResultCode: 0` arrived in the callback but my initial API call returned an error."

These are two different fields with the same numeric convention but very different meanings. Mixing them up is the single most common source of "payment appears successful but isn't" bugs in custom Daraja integrations.

---

## The short answer

| Field | Returned by | Meaning | When |
|---|---|---|---|
| **`ResponseCode`** | Daraja's synchronous HTTP response | "I received your request and it's validly formatted." | Milliseconds after your API call |
| **`ResultCode`** | Your callback URL (async) | "The transaction completed (or failed) with this outcome." | Seconds to minutes after |

**Both use `0` for success.** That's the entire source of the confusion.

---

## Worked example — STK Push

### The synchronous response

When you call `mpesa.collect()` (or the raw `/mpesa/stkpush/v1/processrequest`), Daraja immediately returns:

```json
{
  "MerchantRequestID": "29115-34620561-1",
  "CheckoutRequestID": "ws_CO_191220191020363925",
  "ResponseCode": "0",
  "ResponseDescription": "Success. Request accepted for processing",
  "CustomerMessage": "Success. Request accepted for processing"
}
```

`ResponseCode: "0"` means: **your request was valid and accepted.** It does NOT mean the customer paid. It means: "I have queued this for STK delivery and will post the outcome to your callback URL."

### The async result

Seconds later, Daraja POSTs to your callback URL:

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_191220191020363925",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": { "Item": [ /* receipt, amount, phone */ ] }
    }
  }
}
```

`ResultCode: 0` means: **the customer paid successfully.** This is the outcome. Only now is it safe to mark the order paid.

If the customer cancels, the callback carries `ResultCode: 1032`. If insufficient balance, `ResultCode: 1`. And so on.

---

## Worked example — B2C

### Synchronous response

```json
{
  "OriginatorConversationID": "1234-5678-1",
  "ConversationID": "AG_20240101_...",
  "ResponseCode": "0",
  "ResponseDescription": "Accept the service request successfully."
}
```

Same pattern. `ResponseCode: 0` = "I got your send request." Not "the recipient has the money."

### Async result callback

```json
{
  "Result": {
    "ResultType": 0,
    "ResultCode": 0,
    "ResultDesc": "The service request is processed successfully.",
    "ConversationID": "AG_...",
    "TransactionID": "MEH...",
    "ResultParameters": { /* ... */ }
  }
}
```

`ResultCode: 0` and a `TransactionID` → money moved.

---

## The third field — `ResultType`

For async result callbacks, you'll also see `ResultType`. It describes the kind of result, not the outcome:

- `ResultType: 0` → "Completion result" (terminal — success or failure)
- `ResultType: 1` → "Intermediate result" (rare, informational)

Always gate on `ResultCode`, not `ResultType`, to decide if something succeeded.

---

## What about errors in the synchronous response?

If your request is malformed (bad amount, invalid MSISDN, wrong shortcode), Daraja returns:

```json
{
  "requestId": "12345-1",
  "errorCode": "400.002.02",
  "errorMessage": "Bad Request - Invalid Amount"
}
```

No `ResponseCode` — the HTTP status is 4xx and the body contains `errorCode`. Treat these as request validation failures and don't expect a callback.

---

## The correct decision flow

```
1. Call API
   ├─ HTTP 2xx + ResponseCode: "0"
   │     → Request accepted. Wait for callback.
   │
   ├─ HTTP 2xx + ResponseCode: non-zero
   │     → Request rejected by Daraja logic. No callback will fire.
   │       Handle based on the description.
   │
   └─ HTTP 4xx/5xx
         → Request never reached Daraja's queue. No callback.
           Parse errorCode from the body.

2. Wait for callback (for APIs that use them)
   ├─ ResultCode: 0
   │     → Transaction succeeded. Safe to mark order paid.
   │
   └─ ResultCode: non-zero
         → Transaction failed. Use ResultCode to identify cause.
```

---

## The SDK abstracts this for you

`@daraja-kit/sdk` normalises the flow:

```js
const result = await mpesa.collect({ amount: 100, phone: '0712345678' });
// result.status is 'completed' | 'cancelled' | 'failed' | 'timeout'
// result.receipt is the MpesaReceiptNumber on success
// SDK already merged ResponseCode, ResultCode, and CallbackMetadata into one object
```

If you see the SDK return `status: 'completed'`, you can mark the order paid. The SDK has already verified `ResponseCode: 0` (synchronous) AND `ResultCode: 0` (callback) AND extracted the receipt.

---

## Common bugs this concept prevents

1. **Marking orders paid on `ResponseCode: 0` alone.** Your customer gets a confirmation email for an order they cancelled. Always wait for `ResultCode: 0`.
2. **Treating any non-zero ResultCode as "system error".** Many non-zero codes are user-driven (1032 cancelled, 1 insufficient balance) — not bugs.
3. **Retrying on `ResponseCode: 0`.** The request was accepted; retrying creates a duplicate. Wait for the callback.
4. **Not handling the `ResponseCode: non-zero` case.** If Daraja rejects the request synchronously, no callback fires. Your UI hangs forever unless you handle this path.

---

## Related

- [Callbacks](callbacks.md)
- [Callback Arrived But Pending](../errors/callback-arrived-but-pending.md)
- [Error Codes](../errors/error-codes.md)
- [Top 20 Errors Index](../errors/top-20-index.md)
