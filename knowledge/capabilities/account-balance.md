# Account Balance

## What

Check the available balance on your M-Pesa business shortcode or till number.

## When to Use

Use this when you need to: check balance, see available funds, verify float, monitor account balance, or ensure you have enough funds before processing B2C payments.

## Quick Start

```typescript
import { createClient } from '@daraja-kit/sdk';

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});

const result = await mpesa.balance({
  callbackUrl: 'https://yourdomain.com/api/balance/callback',
});

console.log(result.conversationId);
```

## How It Works

1. Your server calls `mpesa.balance()` with a callback URL.
2. The SDK generates a SecurityCredential automatically.
3. Daraja acknowledges the request.
4. Daraja queries the account balance and sends the result to your callback URL.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `callbackUrl` | `string` | Yes | -- | HTTPS URL to receive the balance result |
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
        {
          "Key": "AccountBalance",
          "Value": "Working Account|KES|50000.00|50000.00|0.00|0.00&Utility Account|KES|100000.00|100000.00|0.00|0.00"
        },
        { "Key": "BOCompletedTime", "Value": "20191219180000" }
      ]
    }
  }
}
```

The `AccountBalance` value is a pipe-delimited string with the format: `AccountName|Currency|Available|Actual|Uncleared|0.00` for each account, separated by `&`.

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

// --- Request Balance ---
app.get('/api/balance', async (_req, res) => {
  try {
    const result = await mpesa.balance({
      callbackUrl: `${CALLBACK_BASE}/api/balance/callback`,
    });

    return res.json({
      success: true,
      message: 'Balance query submitted. Result will arrive via callback.',
      conversationId: result.conversationId,
    });
  } catch (error) {
    console.error('Balance query error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to query balance.',
    });
  }
});

// --- Balance Callback Handler ---
app.post('/api/balance/callback', (req, res) => {
  const { Result } = req.body;

  if (Result.ResultCode === 0) {
    const balanceStr = Result.ResultParameters.ResultParameter
      .find((p: any) => p.Key === 'AccountBalance')?.Value;

    if (balanceStr) {
      // Parse the pipe-delimited balance string
      const accounts = balanceStr.split('&').map((acct: string) => {
        const [name, currency, available, actual] = acct.split('|');
        return { name, currency, available: parseFloat(available), actual: parseFloat(actual) };
      });

      console.log('Account balances:', accounts);

      // TODO: Store or display the balance
    }
  } else {
    console.error(`Balance query failed: ${Result.ResultCode} - ${Result.ResultDesc}`);
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

## Tips

- **Check before B2C:** Query your balance before processing large B2C disbursement batches to ensure sufficient float.
- **Sandbox balance:** In sandbox, the balance may return fixed test values.
- **Account types:** Most shortcodes have a Working Account (for transactions) and a Utility Account.
