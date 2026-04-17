import express from 'express';
import rateLimit from 'express-rate-limit';
import { createClient } from '@daraja-kit/sdk';

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.set('trust proxy', 1);

const mpesa = createClient();
const orders = new Map();

const MAX_AMOUNT = 150_000;

const checkoutLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/checkout', checkoutLimit, async (req, res) => {
  try {
    const { phone, items } = req.body ?? {};
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'phone is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: 'items must be a non-empty array' });
    }

    const rawTotal = items.reduce(
      (sum, item) => sum + Number(item?.price ?? 0) * Number(item?.qty ?? 0),
      0,
    );
    const total = Math.round(rawTotal);
    if (!Number.isFinite(total) || total < 1 || total > MAX_AMOUNT) {
      return res.status(400).json({
        ok: false,
        error: `Order total must be a positive integer between 1 and ${MAX_AMOUNT} KES (got ${total})`,
      });
    }

    const orderId = 'ORD-' + Date.now().toString(36).toUpperCase();
    const result = await mpesa.collect({
      amount: total,
      phone,
      reference: orderId.slice(0, 12),
      description: 'Purchase',
    });

    orders.set(orderId, { items, total, payment: result, createdAt: new Date() });
    res.json({ ok: true, orderId, payment: result });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message,
      suggestion: err.suggestion,
      prevention: err.prevention,
    });
  }
});

app.get('/api/orders/:id', (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
  res.json({ ok: true, order });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`E-commerce store at http://localhost:${PORT}`));
