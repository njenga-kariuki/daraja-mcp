import express from 'express';
import { createClient } from '@daraja-kit/sdk';

const app = express();
app.use(express.json());
app.use(express.static('public'));

const mpesa = createClient();

app.post('/api/donate', async (req, res) => {
  try {
    const { amount, phone } = req.body;
    const result = await mpesa.collect({
      amount: Math.round(Number(amount)),
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
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Donation page running at http://localhost:${PORT}`));
