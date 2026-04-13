# Send Money (B2C)

## What

Send money from your M-Pesa business account to a customer's phone. Used for salary payments, disbursements, refunds, promotional payouts, and any business-to-customer transfer.

## When to Use

Use this when you need to: send money, pay employees, process salary, disburse funds, refund a customer, pay out winnings, send promotional rewards, or transfer from your business float to a person.

## Quick Start

```typescript
import { createClient } from '@daraja-kit/sdk';

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});

const result = await mpesa.send({
  amount: 500,
  phone: '254712345678',
  callbackUrl: 'https://yourdomain.com/api/b2c/callback',
});

console.log(result.conversationId);
```

## How It Works

B2C (Business to Customer) sends money from your business shortcode to a customer's M-Pesa wallet. The flow:

1. Your server calls `mpesa.send()` with amount, phone, and callback URL.
2. The SDK generates a SecurityCredential by RSA-encrypting your initiator password with Safaricom's public certificate. This happens automatically.
3. Daraja validates the request and queues the transfer.
4. You receive an immediate acknowledgement with a `conversationId`.
5. Daraja processes the transfer (usually 5-30 seconds).
6. Daraja sends the final result to your `callbackUrl`.

**Why callbackUrl is required:** Unlike STK Push (which supports polling), B2C is inherently asynchronous with no polling endpoint. The only way to receive the final result is via a callback. You must host a publicly reachable HTTPS endpoint.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `amount` | `number` | Yes | -- | Amount in KES to send (integer, minimum 10 for sandbox) |
| `phone` | `string` | Yes | -- | Recipient phone in format `254XXXXXXXXX` |
| `type` | `string` | No | `'salary'` | Payment type. Maps to Daraja CommandID: `'salary'` = SalaryPayment, `'business'` = BusinessPayment, `'promotion'` = PromotionPayment |
| `remarks` | `string` | No | `'Payment'` | Transaction remarks (max 100 chars) |
| `occasion` | `string` | No | `''` | Optional occasion description (max 100 chars) |
| `callbackUrl` | `string` | Yes | -- | HTTPS URL to receive the final result |
| `timeoutUrl` | `string` | No | Same as `callbackUrl` | HTTPS URL for timeout notifications |

### Payment Types Explained

| SDK Type | Daraja CommandID | Use Case |
|----------|-----------------|----------|
| `'salary'` | SalaryPayment | Employee salary and wages |
| `'business'` | BusinessPayment | General business payments, refunds, disbursements |
| `'promotion'` | PromotionPayment | Promotional payouts, rewards, bonuses |

## Response

### Initiation Response

```typescript
interface SendResult {
  conversationId: string;       // Unique ID for this conversation
  originatorConversationId: string; // Your request's tracking ID
  responseCode: string;         // '0' means accepted for processing
  responseDescription: string;  // e.g., 'Accept the service request successfully.'
}
```

```json
{
  "conversationId": "AG_20191219_00004e48cf7e3533f581",
  "originatorConversationId": "16740-34861180-1",
  "responseCode": "0",
  "responseDescription": "Accept the service request successfully."
}
```

**Note:** This response only means the request was accepted for processing. The actual transfer result arrives at your callback URL.

### Callback Payload

```json
{
  "Result": {
    "ResultType": 0,
    "ResultCode": 0,
    "ResultDesc": "The service request is processed successfully.",
    "OriginatorConversationID": "16740-34861180-1",
    "ConversationID": "AG_20191219_00004e48cf7e3533f581",
    "TransactionID": "SBJ7TLTQA2",
    "ResultParameters": {
      "ResultParameter": [
        { "Key": "TransactionAmount", "Value": 500 },
        { "Key": "TransactionReceipt", "Value": "SBJ7TLTQA2" },
        { "Key": "ReceiverPartyPublicName", "Value": "254712345678 - John Doe" },
        { "Key": "TransactionCompletedDateTime", "Value": "19.12.2019 18:00:00" },
        { "Key": "B2CUtilityAccountAvailableFunds", "Value": 50000.00 },
        { "Key": "B2CWorkingAccountAvailableFunds", "Value": 100000.00 },
        { "Key": "B2CRecipientIsRegisteredCustomer", "Value": "Y" },
        { "Key": "B2CChargesPaidAccountAvailableFunds", "Value": 0.00 }
      ]
    }
  }
}
```

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| SecurityCredential error | Wrong certificate for environment, or wrong initiator password | Ensure you are using the sandbox cert for sandbox and production cert for production. Verify your initiator password matches what Safaricom provided. The SDK handles cert selection automatically based on environment. |
| Initiator credential error (2001) | Initiator name or password not recognized | Check that your initiator name and password are correct. For sandbox, the default initiator is `testapi` with password `Safaricom999!*!`. |
| Insufficient float | Business account does not have enough balance | Top up your M-Pesa business float. Check balance with `mpesa.balance()`. |
| Callback never arrives | Callback URL not reachable | Ensure URL is HTTPS, publicly accessible, and returns HTTP 200. See [Callbacks](../concepts/callbacks.md). |
| Phone not registered | Recipient phone is not an M-Pesa user | Verify the phone number. B2C can only send to registered M-Pesa numbers. |

## Full Example

Complete Express server with B2C payment and callback handler:

```typescript
import express from 'express';
import { createClient } from '@daraja-kit/sdk';

const app = express();
app.use(express.json());

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});

const CALLBACK_BASE = process.env.MPESA_CALLBACK_BASE_URL!;
// e.g., 'https://abc123.ngrok-free.app' for local dev

// --- Initiate B2C Payment ---
app.post('/api/send', async (req, res) => {
  const { amount, phone, type = 'business', remarks } = req.body;

  if (!amount || !phone) {
    return res.status(400).json({ error: 'amount and phone are required' });
  }

  const normalizedPhone = phone.replace(/^0/, '254').replace(/^\+/, '');

  try {
    const result = await mpesa.send({
      amount: Math.round(amount),
      phone: normalizedPhone,
      type,
      remarks: remarks || `Payment of KES ${amount}`,
      callbackUrl: `${CALLBACK_BASE}/api/b2c/callback`,
    });

    // Store the conversationId to match with callback later
    console.log('B2C initiated:', result.conversationId);

    return res.json({
      success: true,
      message: 'Payment is being processed',
      conversationId: result.conversationId,
    });
  } catch (error) {
    console.error('B2C initiation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate payment. Please try again.',
    });
  }
});

// --- B2C Callback Handler ---
app.post('/api/b2c/callback', (req, res) => {
  const { Result } = req.body;

  console.log('B2C callback received:', JSON.stringify(Result, null, 2));

  if (Result.ResultCode === 0) {
    // Payment succeeded
    const params = Result.ResultParameters.ResultParameter;
    const receipt = params.find((p: any) => p.Key === 'TransactionReceipt')?.Value;
    const amount = params.find((p: any) => p.Key === 'TransactionAmount')?.Value;
    const recipient = params.find((p: any) => p.Key === 'ReceiverPartyPublicName')?.Value;

    console.log(`B2C Success: KES ${amount} sent to ${recipient}. Receipt: ${receipt}`);

    // TODO: Update your database -- mark disbursement as completed
  } else {
    // Payment failed
    console.error(`B2C Failed: ${Result.ResultCode} - ${Result.ResultDesc}`);

    // TODO: Update your database -- mark disbursement as failed, queue retry if appropriate
  }

  // Always respond to Daraja (required)
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```
