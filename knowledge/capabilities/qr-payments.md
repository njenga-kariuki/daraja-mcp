# QR Payments

## What

Generate QR codes that customers scan with the M-Pesa app to pay. The QR code pre-fills the payment details (amount, merchant, reference) so the customer just scans and enters their PIN.

## When to Use

Use this when you need to: generate QR codes, enable scan-to-pay, accept in-store payments, create payment links for physical locations, display a payment code on screen, or support offline-first payment initiation.

## Quick Start

```typescript
import { createClient } from '@daraja-kit/sdk';

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});

const result = await mpesa.qr({
  amount: 500,
  merchantName: 'My Store',
  reference: 'INV-001',
});

// result.qrCode is a base64-encoded PNG image
console.log(result.qrCode);
```

## How It Works

1. Your server calls `mpesa.qr()` with amount and merchant details.
2. Daraja generates a QR code containing the payment parameters.
3. You receive a base64-encoded PNG image of the QR code.
4. Display the QR code on screen, print it, or embed it in a webpage.
5. Customer opens M-Pesa app and scans the QR code.
6. M-Pesa app auto-fills the payment details (amount, merchant, reference).
7. Customer enters their M-Pesa PIN to authorize.
8. Payment is processed. Customer and merchant both receive confirmation SMS.

**Note:** QR generation is synchronous -- you get the image back immediately. The actual payment happens later when the customer scans and pays.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `amount` | `number` | Yes | -- | Amount in KES |
| `merchantName` | `string` | No | `'Merchant'` | Business name displayed to customer |
| `reference` | `string` | No | `'Payment'` | Account/invoice reference |
| `type` | `string` | No | `'buygoods'` | QR transaction type (see table below) |
| `size` | `number` | No | `300` | QR code image size in pixels (width and height) |

### QR Transaction Types

| Type | Description |
|------|-------------|
| `'paybill'` | Pay to a PayBill number (customer enters account number) |
| `'buygoods'` | Pay to a Till Number (Buy Goods) -- most common for retail |
| `'send_money'` | Send money to a phone number |
| `'withdraw'` | Withdraw from an M-Pesa agent |
| `'send_to_business'` | Send to a business number |

## Response

```typescript
interface QRResult {
  qrCode: string;          // Base64-encoded PNG image
  requestId: string;        // Daraja request tracking ID
  responseCode: string;     // '0' for success
  responseDescription: string;
}
```

## Full Example

Express server that generates and serves QR codes:

```typescript
import express from 'express';
import { createClient } from '@daraja-kit/sdk';

const app = express();
app.use(express.json());

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});

// --- Generate QR Code ---
app.post('/api/qr', async (req, res) => {
  const { amount, reference, merchantName } = req.body;

  if (!amount) {
    return res.status(400).json({ error: 'amount is required' });
  }

  try {
    const result = await mpesa.qr({
      amount: Math.round(amount),
      merchantName: merchantName || 'My Store',
      reference: reference || `PAY-${Date.now()}`,
      type: 'buygoods',
      size: 400,
    });

    return res.json({
      success: true,
      qrCode: result.qrCode,
    });
  } catch (error) {
    console.error('QR generation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate QR code.',
    });
  }
});

// --- Serve QR as image ---
app.get('/api/qr/image', async (req, res) => {
  const amount = parseInt(req.query.amount as string) || 100;
  const reference = (req.query.reference as string) || 'Payment';

  try {
    const result = await mpesa.qr({
      amount,
      merchantName: 'My Store',
      reference,
    });

    // Convert base64 to buffer and serve as PNG
    const buffer = Buffer.from(result.qrCode, 'base64');
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    console.error('QR image error:', error);
    res.status(500).send('Failed to generate QR code');
  }
});

// --- HTML page with QR code ---
app.get('/pay', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Scan to Pay</title></head>
    <body>
      <h1>Scan to Pay</h1>
      <div id="qr-container">
        <p>Enter amount and click Generate</p>
        <input type="number" id="amount" placeholder="Amount (KES)" min="1" />
        <button onclick="generateQR()">Generate QR Code</button>
      </div>
      <div id="qr-image"></div>
      <script>
        async function generateQR() {
          const amount = document.getElementById('amount').value;
          if (!amount) return alert('Enter an amount');

          const res = await fetch('/api/qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: parseInt(amount) }),
          });
          const data = await res.json();

          if (data.success) {
            document.getElementById('qr-image').innerHTML =
              '<img src="data:image/png;base64,' + data.qrCode + '" alt="M-Pesa QR Code" />' +
              '<p>Scan with M-Pesa app to pay KES ' + amount + '</p>';
          } else {
            alert('Failed to generate QR code');
          }
        }
      </script>
    </body>
    </html>
  `);
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

## Tips

- **Tracking payments from QR:** QR codes initiate a standard M-Pesa payment to your shortcode/till. If you have C2B confirmation URLs registered, you will receive the payment notification there. You can match by reference.
- **Print QR codes:** Generate QR codes for fixed amounts and print them for in-store display. Customers scan instead of typing your till number.
- **Dynamic amounts:** Generate QR codes per transaction/invoice for exact-amount payments.
- **Size:** Default 300px works for screen display. Use 400-600px for print.
