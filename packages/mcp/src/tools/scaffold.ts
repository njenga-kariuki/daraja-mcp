interface ScaffoldInput {
  intent: string;
  framework?: 'express' | 'nextjs' | 'standalone';
  features?: string[];
}

interface ScaffoldFile {
  path: string;
  content: string;
}

interface ScaffoldOutput {
  files: ScaffoldFile[];
  instructions: string;
  template: string;
}

export const scaffoldSchema = {
  name: 'daraja_scaffold',
  description:
    'Generate a complete, runnable M-Pesa integration project from a description of what you want to build. ' +
    'Returns file contents for a working project that uses the @daraja-kit/sdk. ' +
    'Examples: "donation page", "e-commerce checkout", "employee payroll", "QR payment kiosk".',
  inputSchema: {
    type: 'object' as const,
    properties: {
      intent: {
        type: 'string',
        description: 'What the user wants to build.',
      },
      framework: {
        type: 'string',
        enum: ['express', 'nextjs', 'standalone'],
        description: 'Target framework. Default: express.',
      },
      features: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific features to include.',
      },
    },
    required: ['intent'],
  },
};

/** Match intent to template. */
function detectTemplate(intent: string): string {
  const lower = intent.toLowerCase();
  if (lower.includes('donat')) return 'donation-page';
  if (lower.includes('ecommerce') || lower.includes('e-commerce') || lower.includes('shop') || lower.includes('store') || lower.includes('checkout')) return 'ecommerce-checkout';
  if (lower.includes('payroll') || lower.includes('salary') || lower.includes('disburse') || lower.includes('send money') || lower.includes('b2c') || lower.includes('employee')) return 'b2c-payroll';
  if (lower.includes('qr') || lower.includes('scan')) return 'qr-payment';
  if (lower.includes('subscri') || lower.includes('recurring')) return 'subscription';
  return 'donation-page'; // Default to simplest template.
}

export function handleScaffold(input: ScaffoldInput): ScaffoldOutput {
  const template = detectTemplate(input.intent);

  const generators: Record<string, () => ScaffoldFile[]> = {
    'donation-page': generateDonationPage,
    'ecommerce-checkout': generateEcommerceCheckout,
    'b2c-payroll': generateB2cPayroll,
    'qr-payment': generateQrPayment,
    'subscription': generateSubscription,
  };

  const gen = generators[template] ?? generateDonationPage;
  const files = gen();

  return {
    files,
    instructions:
      `## Setup\n` +
      `1. Set your Daraja credentials:\n` +
      `   export DARAJA_CONSUMER_KEY=your_key\n` +
      `   export DARAJA_CONSUMER_SECRET=your_secret\n` +
      `   (Get these free at developer.safaricom.co.ke)\n\n` +
      `2. Install and run:\n` +
      `   npm install\n` +
      `   npm start\n\n` +
      `3. Open http://localhost:3000 in your browser.\n\n` +
      `The app runs in sandbox mode by default — no real money is charged.`,
    template,
  };
}

function generateDonationPage(): ScaffoldFile[] {
  return [
    {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: 'mpesa-donation-page',
          version: '1.0.0',
          type: 'module',
          scripts: { start: 'node server.js' },
          dependencies: { '@daraja-kit/sdk': '^0.1.0', express: '^4.21.0' },
        },
        null,
        2,
      ),
    },
    {
      path: 'server.js',
      content: `import express from 'express';
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
app.listen(PORT, () => console.log(\`Donation page running at http://localhost:\${PORT}\`));
`,
    },
    {
      path: 'public/index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>M-Pesa Donation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: white; border-radius: 12px; padding: 2rem; max-width: 400px; width: 100%; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #666; margin-bottom: 1.5rem; }
    label { display: block; font-weight: 600; margin-bottom: 0.25rem; font-size: 0.9rem; }
    input { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 1rem; font-size: 1rem; }
    button { width: 100%; padding: 0.75rem; background: #00a651; color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; }
    button:hover { background: #008c44; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    #status { margin-top: 1rem; padding: 1rem; border-radius: 8px; display: none; }
    .success { background: #e8f5e9; color: #2e7d32; }
    .error { background: #fce4ec; color: #c62828; }
    .pending { background: #fff3e0; color: #e65100; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Make a Donation</h1>
    <p>Pay securely with M-Pesa</p>
    <form id="form">
      <label for="phone">Phone Number</label>
      <input id="phone" type="tel" placeholder="0712345678" required>
      <label for="amount">Amount (KES)</label>
      <input id="amount" type="number" min="1" placeholder="100" required>
      <button type="submit" id="btn">Donate via M-Pesa</button>
    </form>
    <div id="status"></div>
  </div>
  <script>
    const form = document.getElementById('form');
    const btn = document.getElementById('btn');
    const status = document.getElementById('status');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = 'Processing...';
      status.style.display = 'block';
      status.className = 'pending';
      status.textContent = 'Check your phone for the M-Pesa prompt...';

      try {
        const res = await fetch('/api/donate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: document.getElementById('phone').value,
            amount: document.getElementById('amount').value,
          }),
        });
        const data = await res.json();
        if (data.ok && data.status === 'completed') {
          status.className = 'success';
          status.textContent = 'Thank you! Payment received.' + (data.receipt ? ' Receipt: ' + data.receipt : '');
        } else if (data.ok && data.status === 'cancelled') {
          status.className = 'error';
          status.textContent = 'Payment was cancelled. Please try again.';
        } else {
          status.className = 'error';
          status.textContent = data.suggestion || data.error || 'Payment failed. Please try again.';
        }
      } catch (err) {
        status.className = 'error';
        status.textContent = 'Something went wrong. Please try again.';
      }
      btn.disabled = false;
      btn.textContent = 'Donate via M-Pesa';
    });
  </script>
</body>
</html>`,
    },
  ];
}

function generateEcommerceCheckout(): ScaffoldFile[] {
  return [
    {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: 'mpesa-ecommerce',
          version: '1.0.0',
          type: 'module',
          scripts: { start: 'node server.js' },
          dependencies: { '@daraja-kit/sdk': '^0.1.0', express: '^4.21.0' },
        },
        null,
        2,
      ),
    },
    {
      path: 'server.js',
      content: `import express from 'express';
import { createClient } from '@daraja-kit/sdk';

const app = express();
app.use(express.json());
app.use(express.static('public'));

const mpesa = createClient();

// In-memory orders (use a database in production).
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
app.listen(PORT, () => console.log(\`E-commerce store at http://localhost:\${PORT}\`));
`,
    },
    {
      path: 'public/index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>M-Pesa Shop</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f5f5f5; padding: 2rem; }
    h1 { text-align: center; margin-bottom: 2rem; }
    .products { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; max-width: 800px; margin: 0 auto 2rem; }
    .product { background: white; border-radius: 8px; padding: 1.5rem; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
    .product h3 { margin-bottom: 0.5rem; }
    .price { font-size: 1.2rem; font-weight: 700; color: #00a651; margin-bottom: 1rem; }
    .add-btn { padding: 0.5rem 1rem; background: #00a651; color: white; border: none; border-radius: 6px; cursor: pointer; }
    .cart { max-width: 400px; margin: 0 auto; background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
    .cart h2 { margin-bottom: 1rem; }
    .cart-item { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #eee; }
    .total { font-size: 1.2rem; font-weight: 700; margin: 1rem 0; text-align: right; }
    input { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 1rem; font-size: 1rem; }
    .pay-btn { width: 100%; padding: 0.75rem; background: #00a651; color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; }
    .pay-btn:disabled { background: #ccc; }
    #status { margin-top: 1rem; padding: 1rem; border-radius: 8px; display: none; }
  </style>
</head>
<body>
  <h1>M-Pesa Shop</h1>
  <div class="products" id="products"></div>
  <div class="cart" id="cart-section" style="display:none">
    <h2>Cart</h2>
    <div id="cart-items"></div>
    <div class="total">Total: KES <span id="total">0</span></div>
    <input id="phone" type="tel" placeholder="Phone number (0712345678)">
    <button class="pay-btn" id="pay-btn" onclick="checkout()">Pay with M-Pesa</button>
    <div id="status"></div>
  </div>
  <script>
    const PRODUCTS = [
      { id: 1, name: 'T-Shirt', price: 1500 },
      { id: 2, name: 'Coffee Mug', price: 800 },
      { id: 3, name: 'Notebook', price: 500 },
      { id: 4, name: 'Sticker Pack', price: 200 },
    ];
    const cart = [];

    const productsEl = document.getElementById('products');
    PRODUCTS.forEach(p => {
      productsEl.innerHTML += \`<div class="product"><h3>\${p.name}</h3><div class="price">KES \${p.price}</div><button class="add-btn" onclick="addToCart(\${p.id})">Add to Cart</button></div>\`;
    });

    function addToCart(id) {
      const product = PRODUCTS.find(p => p.id === id);
      const existing = cart.find(c => c.id === id);
      if (existing) existing.qty++;
      else cart.push({ ...product, qty: 1 });
      renderCart();
    }

    function renderCart() {
      document.getElementById('cart-section').style.display = cart.length ? 'block' : 'none';
      const itemsEl = document.getElementById('cart-items');
      itemsEl.innerHTML = cart.map(c => \`<div class="cart-item"><span>\${c.name} x\${c.qty}</span><span>KES \${c.price * c.qty}</span></div>\`).join('');
      document.getElementById('total').textContent = cart.reduce((s, c) => s + c.price * c.qty, 0);
    }

    async function checkout() {
      const btn = document.getElementById('pay-btn');
      const status = document.getElementById('status');
      btn.disabled = true;
      btn.textContent = 'Processing...';
      status.style.display = 'block';
      status.style.background = '#fff3e0';
      status.textContent = 'Check your phone for the M-Pesa prompt...';
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: document.getElementById('phone').value, items: cart }),
        });
        const data = await res.json();
        if (data.ok && data.payment.status === 'completed') {
          status.style.background = '#e8f5e9';
          status.textContent = 'Payment received! Order: ' + data.orderId;
          cart.length = 0;
          renderCart();
        } else {
          status.style.background = '#fce4ec';
          status.textContent = data.suggestion || data.error || 'Payment failed.';
        }
      } catch { status.style.background = '#fce4ec'; status.textContent = 'Error. Try again.'; }
      btn.disabled = false;
      btn.textContent = 'Pay with M-Pesa';
    }
  </script>
</body>
</html>`,
    },
  ];
}

function generateB2cPayroll(): ScaffoldFile[] {
  return [
    {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: 'mpesa-payroll',
          version: '1.0.0',
          type: 'module',
          scripts: { start: 'node server.js' },
          dependencies: { '@daraja-kit/sdk': '^0.1.0', express: '^4.21.0' },
        },
        null,
        2,
      ),
    },
    {
      path: 'server.js',
      content: `import express from 'express';
import { createClient } from '@daraja-kit/sdk';

const app = express();
app.use(express.json());

const mpesa = createClient();

// Single payment.
app.post('/api/send', async (req, res) => {
  try {
    const { amount, phone, type } = req.body;
    const result = await mpesa.send({
      amount: Math.round(Number(amount)),
      phone,
      type: type || 'salary',
      callbackUrl: (process.env.MPESA_CALLBACK_BASE_URL || 'https://example.com') + '/api/callback',
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message, suggestion: err.suggestion });
  }
});

// Batch payments.
app.post('/api/send/batch', async (req, res) => {
  const { payments } = req.body; // [{ phone, amount }]
  const results = [];
  for (const p of payments) {
    try {
      const result = await mpesa.send({
        amount: Math.round(Number(p.amount)),
        phone: p.phone,
        type: 'salary',
        callbackUrl: (process.env.MPESA_CALLBACK_BASE_URL || 'https://example.com') + '/api/callback',
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
  console.log('B2C callback received:', JSON.stringify(req.body, null, 2));
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Payroll service at http://localhost:\${PORT}\`));
`,
    },
    {
      path: 'sample-payroll.json',
      content: JSON.stringify(
        {
          payments: [
            { phone: '254708374149', amount: 5000 },
            { phone: '254708374149', amount: 3000 },
          ],
        },
        null,
        2,
      ),
    },
  ];
}

function generateQrPayment(): ScaffoldFile[] {
  return [
    {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: 'mpesa-qr-payment',
          version: '1.0.0',
          type: 'module',
          scripts: { start: 'node server.js' },
          dependencies: { '@daraja-kit/sdk': '^0.1.0', express: '^4.21.0' },
        },
        null,
        2,
      ),
    },
    {
      path: 'server.js',
      content: `import express from 'express';
import { createClient } from '@daraja-kit/sdk';

const app = express();
app.use(express.json());
app.use(express.static('public'));

const mpesa = createClient();

app.post('/api/qr', async (req, res) => {
  try {
    const { amount, reference } = req.body;
    const result = await mpesa.qr({
      amount: Math.round(Number(amount)),
      reference: reference || 'Payment',
    });
    res.json({ ok: true, qrCode: result.qrCode });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message, suggestion: err.suggestion });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`QR Payment kiosk at http://localhost:\${PORT}\`));
`,
    },
    {
      path: 'public/index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>M-Pesa QR Payment</title>
  <style>
    body { font-family: system-ui; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }
    .card { background: white; border-radius: 12px; padding: 2rem; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 400px; }
    input { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; margin: 0.5rem 0; font-size: 1rem; }
    button { width: 100%; padding: 0.75rem; background: #00a651; color: white; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; margin-top: 0.5rem; }
    #qr { margin-top: 1rem; }
    #qr img { max-width: 250px; border: 2px solid #00a651; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Scan to Pay</h1>
    <p>Generate an M-Pesa QR code</p>
    <input id="amount" type="number" min="1" placeholder="Amount (KES)">
    <button onclick="generate()">Generate QR Code</button>
    <div id="qr"></div>
  </div>
  <script>
    async function generate() {
      const res = await fetch('/api/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: document.getElementById('amount').value }),
      });
      const data = await res.json();
      if (data.ok) {
        document.getElementById('qr').innerHTML = '<img src="data:image/png;base64,' + data.qrCode + '">';
      }
    }
  </script>
</body>
</html>`,
    },
  ];
}

function generateSubscription(): ScaffoldFile[] {
  return [
    {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: 'mpesa-subscription',
          version: '1.0.0',
          type: 'module',
          scripts: { start: 'node server.js' },
          dependencies: { '@daraja-kit/sdk': '^0.1.0', express: '^4.21.0' },
        },
        null,
        2,
      ),
    },
    {
      path: 'server.js',
      content: `import express from 'express';
import { createClient } from '@daraja-kit/sdk';

const app = express();
app.use(express.json());

const mpesa = createClient();

// In-memory subscriber store (use a database in production).
const subscribers = new Map();

// Subscribe.
app.post('/api/subscribe', (req, res) => {
  const { phone, plan, amount } = req.body;
  const id = 'SUB-' + Date.now().toString(36).toUpperCase();
  subscribers.set(id, { phone, plan, amount: Number(amount), active: true, lastCharged: null });
  res.json({ ok: true, subscriptionId: id });
});

// Charge a subscriber (called by cron or manually).
app.post('/api/charge/:id', async (req, res) => {
  const sub = subscribers.get(req.params.id);
  if (!sub || !sub.active) return res.status(404).json({ ok: false, error: 'Subscription not found' });

  try {
    const result = await mpesa.collect({
      amount: sub.amount,
      phone: sub.phone,
      reference: req.params.id.slice(0, 12),
      description: 'Subscription',
    });

    if (result.status === 'completed') {
      sub.lastCharged = new Date();
      res.json({ ok: true, status: 'charged', receipt: result.receipt });
    } else {
      res.json({ ok: false, status: result.status, error: result.errorMessage });
    }
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message, suggestion: err.suggestion });
  }
});

// Charge all active subscribers.
app.post('/api/charge-all', async (_req, res) => {
  const results = [];
  for (const [id, sub] of subscribers) {
    if (!sub.active) continue;
    try {
      const result = await mpesa.collect({ amount: sub.amount, phone: sub.phone, reference: id.slice(0, 12) });
      results.push({ id, status: result.status });
    } catch (err) {
      results.push({ id, status: 'failed', error: err.message });
    }
  }
  res.json({ ok: true, results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Subscription service at http://localhost:\${PORT}\`));
`,
    },
  ];
}
