import express from 'express';
import { createClient } from '@daraja-kit/sdk';

const app = express();
app.use(express.json());
app.use(express.static('public'));

const mpesa = createClient();
const orders = new Map();

app.post('/api/checkout', async (req, res) => {
  try {
    const { phone, items } = req.body;
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const orderId = 'ORD-' + Date.now().toString(36).toUpperCase();

    const result = await mpesa.collect({
      amount: Math.round(total),
      phone,
      reference: orderId.slice(0, 12),
      description: 'Purchase',
    });

    orders.set(orderId, { items, total, payment: result, createdAt: new Date() });
    res.json({ ok: true, orderId, payment: result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message, suggestion: err.suggestion });
  }
});

app.get('/api/orders/:id', (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
  res.json({ ok: true, order });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`E-commerce store at http://localhost:${PORT}`));
