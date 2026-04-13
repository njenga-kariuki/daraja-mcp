# Pattern: Donation Page

Accept donations via M-Pesa STK Push. Visitor enters amount and phone number, receives an STK prompt, enters PIN, and sees a confirmation.

## User Flow

1. Visitor lands on donation page.
2. Enters donation amount and phone number.
3. Clicks "Donate".
4. Receives STK Push prompt on their phone.
5. Enters M-Pesa PIN to authorize.
6. Page updates to show "Thank you, donation received."
7. If payment fails, page shows the reason and a retry button.

## Complete Code

### Server (server.ts)

```typescript
import express from 'express';
import path from 'path';
import { createClient } from '@daraja-kit/sdk';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});

// --- Donation API ---
app.post('/api/donate', async (req, res) => {
  const { amount, phone, name } = req.body;

  // Validate
  if (!amount || !phone) {
    return res.status(400).json({
      success: false,
      message: 'Amount and phone number are required.',
    });
  }

  if (amount < 1) {
    return res.status(400).json({
      success: false,
      message: 'Minimum donation is KES 1.',
    });
  }

  // Normalize phone: 0712... -> 254712..., +254712... -> 254712...
  const normalizedPhone = phone
    .replace(/\s+/g, '')
    .replace(/^0/, '254')
    .replace(/^\+/, '');

  if (!/^254\d{9}$/.test(normalizedPhone)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid phone number. Use format 0712345678 or 254712345678.',
    });
  }

  try {
    const result = await mpesa.collect({
      amount: Math.round(amount),
      phone: normalizedPhone,
      reference: 'Donation',
      description: 'Donation',
      pollTimeout: 70000, // Wait up to 70 seconds
    });

    switch (result.status) {
      case 'success':
        // TODO: Save donation to database
        console.log(`Donation received: KES ${result.amount} from ${normalizedPhone} (${name || 'Anonymous'}). Receipt: ${result.transactionId}`);

        return res.json({
          success: true,
          message: `Thank you! Your donation of KES ${result.amount} has been received.`,
          transactionId: result.transactionId,
        });

      case 'failed':
        return res.json({
          success: false,
          message: getDonationErrorMessage(result.errorCode),
          errorCode: result.errorCode,
        });

      case 'pending':
        return res.json({
          success: false,
          message: 'Payment is still processing. Please check your M-Pesa messages for confirmation.',
        });
    }
  } catch (error) {
    console.error('Donation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again in a moment.',
    });
  }
});

function getDonationErrorMessage(errorCode?: string): string {
  switch (errorCode) {
    case '1032':
      return 'You cancelled the payment. Click Donate to try again.';
    case '1037':
      return 'We could not reach your phone. Please check it is on and has signal, then try again.';
    case '1001':
      return 'Your phone has an active M-Pesa session. Please wait 2 minutes and try again.';
    case '1':
      return 'Insufficient M-Pesa balance. Please top up and try again.';
    case '1025':
    case '9999':
      return 'Could not send the payment prompt. Please try again.';
    default:
      return 'Payment failed. Please try again.';
  }
}

app.listen(3000, () => console.log('Donation server running on http://localhost:3000'));
```

### Frontend (public/index.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Donate via M-Pesa</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p.subtitle { color: #666; margin-bottom: 24px; }
    label { display: block; font-weight: 600; margin-bottom: 4px; margin-top: 16px; }
    input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; }
    input:focus { outline: none; border-color: #4CAF50; }
    .amounts { display: flex; gap: 8px; margin-top: 8px; }
    .amounts button { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: white; cursor: pointer; font-size: 14px; }
    .amounts button:hover { background: #f0f0f0; }
    .amounts button.selected { background: #4CAF50; color: white; border-color: #4CAF50; }
    .donate-btn { width: 100%; padding: 14px; background: #4CAF50; color: white; border: none; border-radius: 8px; font-size: 18px; font-weight: 600; cursor: pointer; margin-top: 24px; }
    .donate-btn:hover { background: #43A047; }
    .donate-btn:disabled { background: #ccc; cursor: not-allowed; }
    .status { margin-top: 16px; padding: 12px; border-radius: 8px; display: none; }
    .status.loading { display: block; background: #FFF3E0; color: #E65100; }
    .status.success { display: block; background: #E8F5E9; color: #2E7D32; }
    .status.error { display: block; background: #FFEBEE; color: #C62828; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Support Our Cause</h1>
    <p class="subtitle">Make a donation via M-Pesa. Quick, safe, and secure.</p>

    <label for="name">Your Name (optional)</label>
    <input type="text" id="name" placeholder="Anonymous" />

    <label for="amount">Donation Amount (KES)</label>
    <input type="number" id="amount" placeholder="Enter amount" min="1" />
    <div class="amounts">
      <button onclick="setAmount(100)">100</button>
      <button onclick="setAmount(500)">500</button>
      <button onclick="setAmount(1000)">1,000</button>
      <button onclick="setAmount(5000)">5,000</button>
    </div>

    <label for="phone">M-Pesa Phone Number</label>
    <input type="tel" id="phone" placeholder="0712345678" />

    <button class="donate-btn" id="donateBtn" onclick="donate()">Donate via M-Pesa</button>

    <div class="status" id="status"></div>
  </div>

  <script>
    function setAmount(value) {
      document.getElementById('amount').value = value;
      document.querySelectorAll('.amounts button').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.textContent.replace(',', '')) === value);
      });
    }

    async function donate() {
      const name = document.getElementById('name').value;
      const amount = parseInt(document.getElementById('amount').value);
      const phone = document.getElementById('phone').value;
      const btn = document.getElementById('donateBtn');
      const status = document.getElementById('status');

      if (!amount || amount < 1) {
        showStatus('Please enter a valid amount.', 'error');
        return;
      }
      if (!phone) {
        showStatus('Please enter your M-Pesa phone number.', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Processing...';
      showStatus('Sending M-Pesa prompt to your phone. Please enter your PIN when prompted.', 'loading');

      try {
        const res = await fetch('/api/donate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, phone, name }),
        });

        const data = await res.json();

        if (data.success) {
          showStatus(data.message + (data.transactionId ? ' Receipt: ' + data.transactionId : ''), 'success');
          btn.textContent = 'Thank You!';
        } else {
          showStatus(data.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Donate via M-Pesa';
        }
      } catch (err) {
        showStatus('Network error. Please check your connection and try again.', 'error');
        btn.disabled = false;
        btn.textContent = 'Donate via M-Pesa';
      }
    }

    function showStatus(message, type) {
      const status = document.getElementById('status');
      status.textContent = message;
      status.className = 'status ' + type;
    }
  </script>
</body>
</html>
```

## Error Handling Summary

| Error Code | User Sees | UX Action |
|------------|-----------|-----------|
| 1032 | "You cancelled the payment..." | Show Donate button again |
| 1037 | "We could not reach your phone..." | Suggest checking phone, show retry |
| 1001 | "Your phone has an active session..." | Ask to wait 2 min, show retry |
| 1 | "Insufficient M-Pesa balance..." | Show retry |
| Timeout | "Payment is still processing..." | Ask to check M-Pesa messages |
| Unknown | "Payment failed. Please try again." | Show retry |

## Production Considerations

1. **Store donations in a database.** Log every donation with: amount, phone, name, transaction ID, timestamp, status.
2. **Send receipts.** After a successful donation, send an SMS or email receipt to the donor.
3. **Idempotency.** Use the M-Pesa transaction ID as a unique key to prevent duplicate donation records from retries.
4. **Analytics.** Track donation conversion rates, average amounts, and failure reasons to optimize the experience.
5. **Tax receipts.** If your organization issues tax-deductible receipts, generate them automatically from the donation record.
6. **Minimum amount.** Consider setting a minimum donation (e.g., KES 10) to avoid trivial amounts.
7. **Thank you page.** Redirect to a proper thank-you page after success, not just an inline message.
