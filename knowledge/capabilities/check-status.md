# Check Transaction Status

## What

Query the status of any M-Pesa transaction. Useful for verifying whether a payment went through, reconciling records, or recovering from missed callbacks.

## When to Use

Use this when you need to: check status, verify payment, confirm whether a payment went through, handle missed callbacks, reconcile transactions, or audit a specific transaction.

**Note:** For STK Push payments, `mpesa.collect()` with the default `poll: true` already handles status checking automatically. You only need `mpesa.status()` for:
- B2C, B2B, or reversal transactions where you missed the callback
- Reconciliation jobs that verify historical transactions
- Any transaction where you have the M-Pesa transaction ID and need to confirm its status

## Quick Start

```typescript
import { createClient } from '@daraja-kit/sdk';

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});

const result = await mpesa.status({
  transactionId: 'SBJ7TLTQA2',
  callbackUrl: 'https://yourdomain.com/api/status/callback',
});

console.log(result.conversationId);
```

## How It Works

1. Your server calls `mpesa.status()` with the M-Pesa transaction ID.
2. The SDK generates a SecurityCredential automatically.
3. Daraja acknowledges the request immediately.
4. Daraja looks up the transaction and sends the result to your callback URL.
5. Your callback handler receives the full transaction details.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `transactionId` | `string` | Yes | -- | The M-Pesa transaction ID (receipt number, e.g., `'SBJ7TLTQA2'`) |
| `callbackUrl` | `string` | Yes | -- | HTTPS URL to receive the status result |
| `timeoutUrl` | `string` | No | Same as `callbackUrl` | HTTPS URL for timeout notifications |

## Response

### Initiation Response

```json
{
  "conversationId": "AG_20191219_00004e48cf7e3533f581",
  "originatorConversationId": "16740-34861180-1",
  "responseCode": "0",
  "responseDescription": "Accept the service request successfully."
}
```

### Callback Payload (Success)

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
        { "Key": "DebitPartyName", "Value": "254712345678 - John Doe" },
        { "Key": "CreditPartyName", "Value": "174379 - Testapi" },
        { "Key": "OriginatorConversationID", "Value": "16740-34861180-1" },
        { "Key": "InitiatedTime", "Value": "20191219180000" },
        { "Key": "DebitAccountType", "Value": "MMF Account" },
        { "Key": "DebitPartyCharges", "Value": "" },
        { "Key": "TransactionReason", "Value": "" },
        { "Key": "ReasonType", "Value": "Payment" },
        { "Key": "TransactionStatus", "Value": "Completed" },
        { "Key": "FinalisedTime", "Value": "20191219180000" },
        { "Key": "Amount", "Value": 100 },
        { "Key": "ConversationID", "Value": "AG_20191219_00004e48cf7e3533f581" },
        { "Key": "ReceiptNo", "Value": "SBJ7TLTQA2" }
      ]
    }
  }
}
```

## Full Example

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

// --- Check Transaction Status ---
app.post('/api/check-status', async (req, res) => {
  const { transactionId } = req.body;

  if (!transactionId) {
    return res.status(400).json({ error: 'transactionId is required' });
  }

  try {
    const result = await mpesa.status({
      transactionId,
      callbackUrl: `${CALLBACK_BASE}/api/status/callback`,
    });

    return res.json({
      success: true,
      message: 'Status query submitted. Result will arrive via callback.',
      conversationId: result.conversationId,
    });
  } catch (error) {
    console.error('Status query error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to query transaction status.',
    });
  }
});

// --- Status Callback Handler ---
app.post('/api/status/callback', (req, res) => {
  const { Result } = req.body;

  if (Result.ResultCode === 0) {
    const params = Result.ResultParameters.ResultParameter;
    const status = params.find((p: any) => p.Key === 'TransactionStatus')?.Value;
    const amount = params.find((p: any) => p.Key === 'Amount')?.Value;
    const receipt = params.find((p: any) => p.Key === 'ReceiptNo')?.Value;

    console.log(`Transaction ${receipt}: ${status}, KES ${amount}`);

    // TODO: Update your records based on the transaction status
  } else {
    console.error(`Status query failed: ${Result.ResultCode} - ${Result.ResultDesc}`);
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

## Tips

- **Transaction ID format:** M-Pesa transaction IDs are alphanumeric receipt numbers like `SBJ7TLTQA2`. This is the receipt number the customer sees in their M-Pesa SMS.
- **Use for reconciliation:** Run a daily job querying the status of any transactions where you did not receive (or lost) the callback result.
- **STK Push alternative:** If you only need to check the status of an STK Push payment, `mpesa.collect({ poll: true })` is simpler -- it handles polling automatically and returns the final result inline.
