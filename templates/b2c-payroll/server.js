import express from 'express';
import rateLimit from 'express-rate-limit';
import { createClient, verifyCallback } from '@daraja-kit/sdk';

const app = express();
app.use(express.json());
app.set('trust proxy', 1);

const mpesa = createClient();

const MAX_AMOUNT = 150_000;
const MAX_BATCH = 100;

const sendLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});
const batchLimit = rateLimit({
  windowMs: 60_000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
});

function validateAmount(raw) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 1 || n > MAX_AMOUNT) {
    return { ok: false, error: `amount must be a whole number between 1 and ${MAX_AMOUNT} KES` };
  }
  return { ok: true, amount: n };
}

// Single payment.
app.post('/api/send', sendLimit, async (req, res) => {
  try {
    const { amount, phone, type } = req.body ?? {};
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'phone is required' });
    }
    const amountCheck = validateAmount(amount);
    if (!amountCheck.ok) {
      return res.status(400).json({ ok: false, error: amountCheck.error });
    }

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
      amount: amountCheck.amount,
      phone,
      type: type || 'salary',
      callbackUrl: `${callbackBase}/api/callback`,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message,
      suggestion: err.suggestion,
      prevention: err.prevention,
    });
  }
});

// Batch payments.
app.post('/api/send/batch', batchLimit, async (req, res) => {
  const { payments } = req.body ?? {};
  if (!Array.isArray(payments) || payments.length === 0) {
    return res.status(400).json({ ok: false, error: 'payments must be a non-empty array' });
  }
  if (payments.length > MAX_BATCH) {
    return res.status(400).json({
      ok: false,
      error: `batch size ${payments.length} exceeds the ${MAX_BATCH}-per-request cap — split your run`,
    });
  }
  const callbackBase = process.env.MPESA_CALLBACK_BASE_URL;
  if (!callbackBase) {
    return res.status(400).json({ ok: false, error: 'MPESA_CALLBACK_BASE_URL required' });
  }

  const results = [];
  for (const p of payments) {
    const amountCheck = validateAmount(p.amount);
    if (!p.phone || !amountCheck.ok) {
      results.push({
        phone: p.phone,
        status: 'rejected',
        error: !p.phone ? 'phone missing' : amountCheck.error,
      });
      continue;
    }
    try {
      const result = await mpesa.send({
        amount: amountCheck.amount,
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

// Callback handler — verify source IP, parse payload, deduplicate.
const DEV_ALLOW_ANY_IP = process.env.NODE_ENV !== 'production';
if (DEV_ALLOW_ANY_IP) {
  console.warn(
    '[dev] callback IP check relaxed to "any" — set NODE_ENV=production before deploying.',
  );
}

app.post('/api/callback', (req, res) => {
  const result = verifyCallback(req.body, {
    ip: req.ip,
    ...(DEV_ALLOW_ANY_IP ? { allowedIPs: 'any' } : {}),
  });
  if (!result.valid) {
    console.warn('Rejected callback:', result.reason);
    return res.status(403).json({ error: result.reason });
  }
  if (result.duplicate) {
    return res.json({ ResultCode: 0, ResultDesc: 'Duplicate — already processed' });
  }
  // TODO: persist result.data to your ledger (resultCode, transactionId, conversationId)
  console.log('B2C result:', result.data);
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Payroll service at http://localhost:${PORT}`));
