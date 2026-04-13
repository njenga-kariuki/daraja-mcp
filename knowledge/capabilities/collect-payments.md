# Collect Payments

## What

Accept M-Pesa payments from customers. The SDK sends an STK Push to the customer's phone, they enter their PIN, and you receive the result -- all in one call, no callbacks needed.

## When to Use

Use this when you need to: accept payments, charge customers, checkout, collect money, receive payments, process orders, handle donations, or any scenario where a customer pays your business.

## Quick Start

```typescript
import { createClient } from '@daraja-kit/sdk';

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});

const result = await mpesa.collect({
  amount: 100,
  phone: '254712345678',
});

console.log(result.status); // 'success' | 'failed' | 'pending'
```

## How It Works

STK Push (Lipa Na M-Pesa Online) is the primary payment collection method. The flow:

1. Your server calls `mpesa.collect()` with amount and phone number.
2. Daraja sends an STK Push prompt to the customer's phone.
3. The customer sees a payment prompt with amount and merchant name.
4. The customer enters their M-Pesa PIN to authorize.
5. Daraja processes the payment.
6. The SDK polls STK Query every 3 seconds until the transaction resolves or the timeout is reached (default: 60 seconds).
7. You receive a final result with `status: 'success'` or `status: 'failed'`.

**Auto-polling** is the key SDK feature here. Raw Daraja requires you to either set up a callback URL or manually poll the STK Query endpoint. The SDK handles polling automatically -- you call `collect()` and await a final result.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `amount` | `number` | Yes | -- | Amount to charge in KES (integer, minimum 1) |
| `phone` | `string` | Yes | -- | Customer phone in format `254XXXXXXXXX` (12 digits) |
| `reference` | `string` | No | `'Payment'` | Account reference shown on STK prompt and M-Pesa statement (max 12 chars) |
| `description` | `string` | No | `'Payment'` | Transaction description (max 13 chars -- exceeding this causes error 1025/9999) |
| `poll` | `boolean` | No | `true` | Whether to poll for final result. Set `false` to get only the initiation response. |
| `pollInterval` | `number` | No | `3000` | Milliseconds between poll attempts |
| `pollTimeout` | `number` | No | `60000` | Maximum milliseconds to wait for a final result |

## Response

### CollectResult

```typescript
interface CollectResult {
  status: 'success' | 'failed' | 'pending';
  transactionId?: string;    // M-Pesa receipt number (e.g., 'SBJ7TLTQA2')
  phone?: string;            // Phone number charged
  amount?: number;           // Amount charged
  merchantRequestId: string; // Daraja merchant request ID
  checkoutRequestId: string; // Daraja checkout request ID
  errorCode?: string;        // Daraja result code on failure
  errorMessage?: string;     // Human-readable failure reason
}
```

### Success Response

```json
{
  "status": "success",
  "transactionId": "SBJ7TLTQA2",
  "phone": "254712345678",
  "amount": 100,
  "merchantRequestId": "29115-34620561-1",
  "checkoutRequestId": "ws_CO_191220191020363925"
}
```

### Failed Response (User Cancelled)

```json
{
  "status": "failed",
  "merchantRequestId": "29115-34620561-1",
  "checkoutRequestId": "ws_CO_191220191020363925",
  "errorCode": "1032",
  "errorMessage": "Request cancelled by user"
}
```

### Pending Response (Timeout Before Resolution)

```json
{
  "status": "pending",
  "merchantRequestId": "29115-34620561-1",
  "checkoutRequestId": "ws_CO_191220191020363925"
}
```

## Common Issues

| Error Code | Meaning | Cause | Fix |
|------------|---------|-------|-----|
| `1032` | Request cancelled by user | Customer declined the STK Push or dismissed the prompt | Prompt user to retry. Add UX messaging: "Payment cancelled. Tap Pay to try again." |
| `1037` | DS timeout -- phone unreachable | Phone is off, in airplane mode, or has no signal. Especially common with iOS eSIM devices. | Ask customer to check their phone is on and has signal. Restarting the phone often fixes eSIM issues. Retry after a few seconds. |
| `1001` | USSD session in progress | Customer has an active USSD session (e.g., dialed *334#) | Ask customer to cancel any active USSD sessions and retry after 2-3 minutes. |
| `1025` | STK delivery failed | Often caused by `description` exceeding 13 characters | Shorten `description` to 13 characters or fewer. |
| `9999` | STK delivery failed | Same as 1025 -- description or reference too long, or temporary Daraja issue | Shorten `description` and `reference`. Retry once if params are already short. |

## Full Example

Complete Express route with error handling:

```typescript
import express from 'express';
import { createClient } from '@daraja-kit/sdk';

const app = express();
app.use(express.json());

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});

app.post('/api/pay', async (req, res) => {
  const { amount, phone } = req.body;

  // Validate input
  if (!amount || !phone) {
    return res.status(400).json({ error: 'amount and phone are required' });
  }

  if (amount < 1) {
    return res.status(400).json({ error: 'Amount must be at least 1 KES' });
  }

  // Normalize phone: accept 0712345678 or +254712345678
  const normalizedPhone = phone.replace(/^0/, '254').replace(/^\+/, '');

  try {
    const result = await mpesa.collect({
      amount: Math.round(amount),
      phone: normalizedPhone,
      reference: 'ORDER123',
      description: 'Payment',
    });

    switch (result.status) {
      case 'success':
        // Payment confirmed -- fulfill the order
        return res.json({
          success: true,
          transactionId: result.transactionId,
          message: `Payment of KES ${result.amount} received`,
        });

      case 'failed':
        // Payment failed -- tell the user why
        return res.json({
          success: false,
          errorCode: result.errorCode,
          message: getFailureMessage(result.errorCode),
        });

      case 'pending':
        // Timed out waiting for result
        return res.json({
          success: false,
          message: 'Payment is still processing. Please check your M-Pesa messages.',
          checkoutRequestId: result.checkoutRequestId,
        });
    }
  } catch (error) {
    console.error('M-Pesa collect error:', error);
    return res.status(500).json({
      success: false,
      message: 'Payment service temporarily unavailable. Please try again.',
    });
  }
});

function getFailureMessage(errorCode?: string): string {
  switch (errorCode) {
    case '1032':
      return 'You cancelled the payment. Tap Pay to try again.';
    case '1037':
      return 'Could not reach your phone. Check your phone is on and has signal, then retry.';
    case '1001':
      return 'Your phone has an active USSD session. Cancel it and try again in 2 minutes.';
    case '1025':
    case '9999':
      return 'Payment could not be delivered to your phone. Please try again.';
    default:
      return 'Payment failed. Please try again.';
  }
}

app.listen(3000, () => console.log('Server running on port 3000'));
```

## Advanced: C2B Registration

C2B (Customer to Business) is the alternative payment collection method. Instead of the merchant initiating an STK Push, the customer initiates payment themselves via the M-Pesa USSD menu (*334#) or M-Pesa app, entering your PayBill number and account reference.

Use C2B when:
- You want customers to pay via USSD menu (no smartphone needed)
- You need to support payments from feature phones
- You run a PayBill or Till Number that receives organic payments

C2B requires registering validation and confirmation URLs with Daraja:

```typescript
// C2B registration is not yet wrapped in the SDK.
// Use the raw Daraja API:

// POST https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl
// Headers: Authorization: Bearer <access_token>
// Body:
{
  "ShortCode": "174379",
  "ResponseType": "Completed",  // or "Cancelled"
  "ConfirmationURL": "https://yourdomain.com/api/c2b/confirm",
  "ValidationURL": "https://yourdomain.com/api/c2b/validate"
}
```

After registration, Daraja will POST to your URLs whenever a customer pays your shortcode. Your validation URL can accept or reject the transaction. Your confirmation URL receives the final payment details.

For most integrations, STK Push via `mpesa.collect()` is simpler and recommended. C2B is for specific use cases where the customer must initiate.
