import express from 'express';
import rateLimit from 'express-rate-limit';
import { createClient } from '@daraja-kit/sdk';

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.set('trust proxy', 1);

const mpesa = createClient();

const MAX_AMOUNT = 150_000;

const donateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/donate', donateLimit, async (req, res) => {
  try {
    const { amount, phone } = req.body ?? {};
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'phone is required' });
    }
    const parsed = Math.round(Number(amount));
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_AMOUNT) {
      return res.status(400).json({
        ok: false,
        error: `Donation amount must be a positive integer between 1 and ${MAX_AMOUNT} KES (got ${amount})`,
      });
    }

    const result = await mpesa.collect({
      amount: parsed,
      phone,
      reference: 'DONATION',
      description: 'Donation',
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message,
      suggestion: err.suggestion ?? 'Check your input and try again.',
      prevention: err.prevention,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Donation page running at http://localhost:${PORT}`));
