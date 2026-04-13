# Refunds (Transaction Reversal)

## What

Reverse a completed M-Pesa transaction. The reversed amount is returned to the original sender. Used for refunds, accidental payments, and dispute resolution.

## When to Use

Use this when you need to: refund a customer, reverse a transaction, cancel a completed payment, undo a transaction, or process a chargeback.

## Quick Start

```typescript
import { createClient } from '@daraja-kit/sdk';

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});

const result = await mpesa.reverse({
  transactionId: 'SBJ7TLTQA2',
  amount: 100,
  callbackUrl: 'https://yourdomain.com/api/reversal/callback',
});

console.log(result.conversationId);
```

## How It Works

1. Your server calls `mpesa.reverse()` with the original transaction ID and amount.
2. The SDK generates a SecurityCredential automatically.
3. Daraja validates the request and queues the reversal.
4. You receive an immediate acknowledgement.
5. Daraja processes the reversal (can take seconds to minutes).
6. Daraja sends the final result to your `callbackUrl`.
7. The customer receives the reversed amount back in their M-Pesa wallet.

## Important Constraints

- **You can only reverse transactions that were paid to your shortcode.** You cannot reverse arbitrary M-Pesa transactions.
- **You need the original M-Pesa transaction ID** (the receipt number, e.g., `SBJ7TLTQA2`).
- **Reversals are not instant.** They are processed asynchronously and the result arrives via callback.
- **Partial reversals are supported.** The `amount` can be less than or equal to the original transaction amount.
- **Reversals may fail** if the recipient has already spent the funds or if the transaction is too old.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `transactionId` | `string` | Yes | -- | The original M-Pesa transaction ID (receipt number) to reverse |
| `amount` | `number` | Yes | -- | Amount to reverse in KES. Must be less than or equal to original amount. |
| `callbackUrl` | `string` | Yes | -- | HTTPS URL to receive the reversal result |
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
    "TransactionID": "SBK7XYZAB3",
    "ResultParameters": {
      "ResultParameter": [
        { "Key": "DebitAccountCurrentBalance", "Value": "{Amount={CurrencyCode=KES, MinimumAmount=49900, BasicAmount=499.00}}" },
        { "Key": "Amount", "Value": 100 },
        { "Key": "TransCompletedTime", "Value": "20191219180000" },
        { "Key": "OriginalTransactionID", "Value": "SBJ7TLTQA2" },
        { "Key": "Charge", "Value": 0 },
        { "Key": "CreditPartyPublicName", "Value": "254712345678 - John Doe" },
        { "Key": "DebitPartyPublicName", "Value": "174379 - Testapi" }
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

// --- Initiate Reversal ---
app.post('/api/refund', async (req, res) => {
  const { transactionId, amount } = req.body;

  if (!transactionId || !amount) {
    return res.status(400).json({ error: 'transactionId and amount are required' });
  }

  try {
    const result = await mpesa.reverse({
      transactionId,
      amount: Math.round(amount),
      callbackUrl: `${CALLBACK_BASE}/api/reversal/callback`,
    });

    return res.json({
      success: true,
      message: 'Refund is being processed',
      conversationId: result.conversationId,
    });
  } catch (error) {
    console.error('Reversal error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate refund. Please try again.',
    });
  }
});

// --- Reversal Callback Handler ---
app.post('/api/reversal/callback', (req, res) => {
  const { Result } = req.body;

  if (Result.ResultCode === 0) {
    const params = Result.ResultParameters.ResultParameter;
    const originalTxn = params.find((p: any) => p.Key === 'OriginalTransactionID')?.Value;
    const amount = params.find((p: any) => p.Key === 'Amount')?.Value;
    const recipient = params.find((p: any) => p.Key === 'CreditPartyPublicName')?.Value;

    console.log(`Reversal success: KES ${amount} returned for txn ${originalTxn} to ${recipient}`);

    // TODO: Update order status to "refunded" in your database
  } else {
    console.error(`Reversal failed: ${Result.ResultCode} - ${Result.ResultDesc}`);

    // TODO: Mark refund as failed, alert support team
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

## Tips

- **Store the original transaction ID** whenever you receive a payment. You will need it if you ever need to issue a refund.
- **Partial refunds:** Set `amount` to less than the original payment amount to issue a partial refund.
- **Refund timing:** Process refunds as soon as possible. Older transactions may be harder to reverse.
- **Alternative to reversal:** For STK Push payments, you can also use B2C (`mpesa.send()`) to send money back to the customer. This is more reliable for older transactions but costs you the B2C transaction fee.
