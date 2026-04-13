# Business Payments (B2B)

## What

Pay other businesses via M-Pesa. Send money from your business shortcode to another PayBill or Buy Goods (Till) number. Used for supplier payments, inter-business transfers, and wholesale purchases.

## When to Use

Use this when you need to: pay a supplier, transfer to another business, pay a PayBill from your business account, buy goods from a till number using business float, or settle inter-company accounts.

## SDK Status

**Not yet wrapped in the SDK.** B2B is available via the raw Daraja API. The information below covers the direct API endpoint and parameters.

## Quick Start (Raw API)

```typescript
// B2B is not yet in the SDK. Use the raw Daraja API directly.
// This example shows the HTTP request structure.

const response = await fetch('https://sandbox.safaricom.co.ke/mpesa/b2b/v1/paymentrequest', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    Initiator: 'testapi',
    SecurityCredential: securityCredential, // RSA-encrypted initiator password
    CommandID: 'BusinessPayBill',           // or 'BusinessBuyGoods'
    SenderIdentifierType: '4',              // 4 = shortcode
    RecieverIdentifierType: '4',            // 4 = shortcode
    Amount: 1000,
    PartyA: '174379',                       // Your shortcode
    PartyB: '000000',                       // Recipient shortcode/till
    AccountReference: 'INV-001',
    Remarks: 'Supplier payment',
    QueueTimeOutURL: 'https://yourdomain.com/api/b2b/timeout',
    ResultURL: 'https://yourdomain.com/api/b2b/callback',
  }),
});
```

## API Details

### Endpoint

| Environment | URL |
|-------------|-----|
| Sandbox | `https://sandbox.safaricom.co.ke/mpesa/b2b/v1/paymentrequest` |
| Production | `https://api.safaricom.co.ke/mpesa/b2b/v1/paymentrequest` |

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `Initiator` | `string` | Yes | API operator username (sandbox: `testapi`) |
| `SecurityCredential` | `string` | Yes | RSA-encrypted initiator password using Safaricom's certificate |
| `CommandID` | `string` | Yes | `BusinessPayBill` or `BusinessBuyGoods` or `MerchantToMerchantTransfer` or `MerchantTransferFromMerchantToWorking` or `MerchantServicesMMFAccountTransfer` or `AgencyFloatAdvance` |
| `SenderIdentifierType` | `string` | Yes | `4` for shortcode |
| `RecieverIdentifierType` | `string` | Yes | `4` for shortcode |
| `Amount` | `number` | Yes | Amount in KES |
| `PartyA` | `string` | Yes | Your shortcode (sender) |
| `PartyB` | `string` | Yes | Recipient shortcode or till number |
| `AccountReference` | `string` | Yes | Account/invoice reference (max 13 chars) |
| `Remarks` | `string` | Yes | Transaction remarks (max 100 chars) |
| `QueueTimeOutURL` | `string` | Yes | Callback URL for timeout |
| `ResultURL` | `string` | Yes | Callback URL for final result |

### CommandID Options

| CommandID | Use Case |
|-----------|----------|
| `BusinessPayBill` | Pay to a PayBill number |
| `BusinessBuyGoods` | Pay to a Till Number (Buy Goods) |
| `MerchantToMerchantTransfer` | Transfer between merchants |
| `MerchantTransferFromMerchantToWorking` | Transfer from merchant to working account |
| `MerchantServicesMMFAccountTransfer` | Transfer MMF account |
| `AgencyFloatAdvance` | Agency float advance |

## Callback Payload

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
        { "Key": "DebitAccountBalance", "Value": "Working Account|KES|49000.00" },
        { "Key": "Amount", "Value": 1000 },
        { "Key": "DebitPartyAffectedAccountBalance", "Value": "Working Account|KES|49000.00" },
        { "Key": "TransCompletedTime", "Value": "20191219180000" },
        { "Key": "DebitPartyCharges", "Value": "0.00" },
        { "Key": "ReceiverPartyPublicName", "Value": "000000 - Test Merchant" },
        { "Key": "Currency", "Value": "KES" },
        { "Key": "InitiatorAccountCurrentBalance", "Value": "Working Account|KES|49000.00" }
      ]
    }
  }
}
```

## Full Example

```typescript
import express from 'express';
import crypto from 'crypto';
import fs from 'fs';

const app = express();
app.use(express.json());

// --- Helper: Get OAuth token ---
async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`
  ).toString('base64');

  const response = await fetch(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${credentials}` } }
  );

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

// --- Helper: Generate SecurityCredential ---
function generateSecurityCredential(password: string, certPath: string): string {
  const cert = fs.readFileSync(certPath, 'utf-8');
  const encrypted = crypto.publicEncrypt(
    { key: cert, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(password)
  );
  return encrypted.toString('base64');
}

// --- Initiate B2B Payment ---
app.post('/api/b2b', async (req, res) => {
  const { amount, recipient, accountReference, remarks } = req.body;

  try {
    const accessToken = await getAccessToken();
    const securityCredential = generateSecurityCredential(
      'Safaricom999!*!', // sandbox initiator password
      './certs/SandboxCertificate.cer'
    );

    const response = await fetch(
      'https://sandbox.safaricom.co.ke/mpesa/b2b/v1/paymentrequest',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Initiator: 'testapi',
          SecurityCredential: securityCredential,
          CommandID: 'BusinessPayBill',
          SenderIdentifierType: '4',
          RecieverIdentifierType: '4',
          Amount: amount,
          PartyA: '174379',
          PartyB: recipient,
          AccountReference: accountReference || 'Payment',
          Remarks: remarks || 'B2B Payment',
          QueueTimeOutURL: `${process.env.MPESA_CALLBACK_BASE_URL}/api/b2b/timeout`,
          ResultURL: `${process.env.MPESA_CALLBACK_BASE_URL}/api/b2b/callback`,
        }),
      }
    );

    const data = await response.json();
    return res.json({ success: true, data });
  } catch (error) {
    console.error('B2B error:', error);
    return res.status(500).json({ success: false, message: 'B2B payment failed' });
  }
});

// --- B2B Callback Handler ---
app.post('/api/b2b/callback', (req, res) => {
  const { Result } = req.body;

  if (Result.ResultCode === 0) {
    console.log('B2B payment successful:', Result.TransactionID);
  } else {
    console.error(`B2B payment failed: ${Result.ResultCode} - ${Result.ResultDesc}`);
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.post('/api/b2b/timeout', (req, res) => {
  console.error('B2B timeout:', req.body);
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

## Tips

- **SecurityCredential:** Use the same RSA encryption as B2C. The SDK handles this for B2C/Status/Balance/Reversal, but for B2B you need to generate it manually (for now).
- **Sandbox shortcodes:** Use `174379` as your sender shortcode in sandbox.
- **SDK support coming:** B2B will be added to `@daraja-kit/sdk` in a future release.
