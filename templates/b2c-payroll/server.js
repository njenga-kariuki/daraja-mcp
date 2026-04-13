import express from 'express';
import { createClient } from '@daraja-kit/sdk';

const app = express();
app.use(express.json());

const mpesa = createClient();

// Single payment.
app.post('/api/send', async (req, res) => {
  try {
    const { amount, phone, type } = req.body;
    const callbackBase = process.env.MPESA_CALLBACK_BASE_URL;
    if (!callbackBase) {
      return res.status(400).json({
        ok: false,
        error: 'MPESA_CALLBACK_BASE_URL is required for B2C payments',
        suggestion:
          'B2C payments need a public callback URL. For local dev: npx ngrok http 3000, ' +
          'then export MPESA_CALLBACK_BASE_URL=https://your-ngrok-url',
      });
    }

    const result = await mpesa.send({
      amount: Math.round(Number(amount)),
      phone,
      type: type || 'salary',
      callbackUrl: `${callbackBase}/api/callback`,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message, suggestion: err.suggestion });
  }
});

// Batch payments.
app.post('/api/send/batch', async (req, res) => {
  const { payments } = req.body;
  const callbackBase = process.env.MPESA_CALLBACK_BASE_URL;
  if (!callbackBase) {
    return res.status(400).json({ ok: false, error: 'MPESA_CALLBACK_BASE_URL required' });
  }

  const results = [];
  for (const p of payments) {
    try {
      const result = await mpesa.send({
        amount: Math.round(Number(p.amount)),
        phone: p.phone,
        type: 'salary',
        callbackUrl: `${callbackBase}/api/callback`,
      });
      results.push({ phone: p.phone, status: 'queued', ...result });
    } catch (err) {
      results.push({ phone: p.phone, status: 'failed', error: err.message });
    }
  }
  res.json({ ok: true, results });
});

// Callback handler.
app.post('/api/callback', (req, res) => {
  console.log('B2C result:', JSON.stringify(req.body, null, 2));
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Payroll service at http://localhost:${PORT}`));
