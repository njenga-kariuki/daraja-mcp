# Pattern: E-Commerce Checkout

Integrate M-Pesa STK Push into a product checkout flow. Customer browses products, adds to cart, enters phone at checkout, and pays via M-Pesa.

## User Flow

1. Customer browses products and adds items to cart.
2. Customer proceeds to checkout.
3. Checkout page shows order summary and asks for M-Pesa phone number.
4. Customer enters phone and clicks "Pay with M-Pesa".
5. Customer receives STK Push prompt, enters PIN.
6. Page updates to show "Order confirmed" with order number.
7. If payment fails, customer sees the reason and can retry.

## Complete Code

### Server (server.ts)

```typescript
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@daraja-kit/sdk';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});

// --- In-memory store (use a real database in production) ---
interface Product {
  id: string;
  name: string;
  price: number;
}

interface Order {
  id: string;
  items: { productId: string; quantity: number; price: number }[];
  total: number;
  phone: string;
  status: 'pending' | 'paid' | 'failed';
  transactionId?: string;
  createdAt: Date;
}

const products: Product[] = [
  { id: 'p1', name: 'Basic T-Shirt', price: 1500 },
  { id: 'p2', name: 'Denim Jeans', price: 3500 },
  { id: 'p3', name: 'Sneakers', price: 5000 },
  { id: 'p4', name: 'Baseball Cap', price: 800 },
];

const orders = new Map<string, Order>();

// --- Products API ---
app.get('/api/products', (_req, res) => {
  res.json(products);
});

// --- Create Order and Pay ---
app.post('/api/checkout', async (req, res) => {
  const { items, phone } = req.body;

  // Validate input
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Cart is empty.' });
  }
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Phone number is required.' });
  }

  // Normalize phone
  const normalizedPhone = phone.replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
  if (!/^254\d{9}$/.test(normalizedPhone)) {
    return res.status(400).json({ success: false, message: 'Invalid phone number format.' });
  }

  // Calculate order total
  const orderItems = items.map((item: { productId: string; quantity: number }) => {
    const product = products.find(p => p.id === item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found`);
    return {
      productId: item.productId,
      quantity: item.quantity,
      price: product.price,
    };
  });

  const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Create order
  const orderId = `ORD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const order: Order = {
    id: orderId,
    items: orderItems,
    total,
    phone: normalizedPhone,
    status: 'pending',
    createdAt: new Date(),
  };
  orders.set(orderId, order);

  // Initiate M-Pesa payment
  try {
    const result = await mpesa.collect({
      amount: total,
      phone: normalizedPhone,
      reference: orderId,
      description: 'Order Payment',
      pollTimeout: 70000,
    });

    switch (result.status) {
      case 'success':
        order.status = 'paid';
        order.transactionId = result.transactionId;
        orders.set(orderId, order);

        console.log(`Order ${orderId} paid. Receipt: ${result.transactionId}`);

        return res.json({
          success: true,
          message: 'Payment received. Your order is confirmed!',
          orderId,
          transactionId: result.transactionId,
          total,
        });

      case 'failed':
        order.status = 'failed';
        orders.set(orderId, order);

        return res.json({
          success: false,
          message: getCheckoutErrorMessage(result.errorCode),
          orderId,
          errorCode: result.errorCode,
        });

      case 'pending':
        // Payment still processing -- keep order as pending
        return res.json({
          success: false,
          message: 'Payment is still processing. Check your M-Pesa messages and refresh this page.',
          orderId,
        });
    }
  } catch (error) {
    console.error(`Checkout error for order ${orderId}:`, error);
    order.status = 'failed';
    orders.set(orderId, order);

    return res.status(500).json({
      success: false,
      message: 'Payment service is temporarily unavailable. Please try again.',
      orderId,
    });
  }
});

// --- Check Order Status ---
app.get('/api/orders/:orderId', (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }
  return res.json({ success: true, order });
});

// --- Retry Payment for Failed Order ---
app.post('/api/orders/:orderId/retry', async (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }
  if (order.status === 'paid') {
    return res.json({ success: true, message: 'Order is already paid.' });
  }

  const phone = req.body.phone
    ? req.body.phone.replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '')
    : order.phone;

  try {
    order.status = 'pending';
    orders.set(order.id, order);

    const result = await mpesa.collect({
      amount: order.total,
      phone,
      reference: order.id,
      description: 'Order Payment',
      pollTimeout: 70000,
    });

    if (result.status === 'success') {
      order.status = 'paid';
      order.transactionId = result.transactionId;
      orders.set(order.id, order);

      return res.json({
        success: true,
        message: 'Payment received. Your order is confirmed!',
        orderId: order.id,
        transactionId: result.transactionId,
      });
    }

    order.status = 'failed';
    orders.set(order.id, order);

    return res.json({
      success: false,
      message: getCheckoutErrorMessage(result.errorCode),
    });
  } catch (error) {
    console.error(`Retry error for order ${order.id}:`, error);
    order.status = 'failed';
    orders.set(order.id, order);

    return res.status(500).json({
      success: false,
      message: 'Payment failed. Please try again.',
    });
  }
});

function getCheckoutErrorMessage(errorCode?: string): string {
  switch (errorCode) {
    case '1032':
      return 'You cancelled the payment. Click Pay to try again.';
    case '1037':
      return 'Could not reach your phone. Check it is on and has signal, then retry.';
    case '1001':
      return 'Your phone has an active M-Pesa session. Wait 2 minutes and retry.';
    case '1':
      return 'Insufficient M-Pesa balance. Top up and try again.';
    default:
      return 'Payment failed. Please try again.';
  }
}

app.listen(3000, () => console.log('E-commerce server running on http://localhost:3000'));
```

### Frontend (public/index.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Shop - Pay with M-Pesa</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { margin-bottom: 24px; }
    .products { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .product { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .product h3 { margin-bottom: 8px; }
    .product .price { font-size: 18px; font-weight: 600; color: #4CAF50; }
    .product button { margin-top: 12px; padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; }
    .cart { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px; }
    .cart h2 { margin-bottom: 16px; }
    .cart-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .cart-total { font-size: 20px; font-weight: 700; margin-top: 12px; text-align: right; }
    .checkout { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .checkout input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; margin: 8px 0 16px; }
    .pay-btn { width: 100%; padding: 14px; background: #4CAF50; color: white; border: none; border-radius: 8px; font-size: 18px; font-weight: 600; cursor: pointer; }
    .pay-btn:disabled { background: #ccc; cursor: not-allowed; }
    .status { margin-top: 16px; padding: 12px; border-radius: 8px; display: none; }
    .status.loading { display: block; background: #FFF3E0; color: #E65100; }
    .status.success { display: block; background: #E8F5E9; color: #2E7D32; }
    .status.error { display: block; background: #FFEBEE; color: #C62828; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Shop</h1>
    <div class="products" id="products"></div>

    <div class="cart" id="cartSection" style="display:none">
      <h2>Your Cart</h2>
      <div id="cartItems"></div>
      <div class="cart-total">Total: KES <span id="cartTotal">0</span></div>
    </div>

    <div class="checkout" id="checkoutSection" style="display:none">
      <h2>Pay with M-Pesa</h2>
      <label for="phone">M-Pesa Phone Number</label>
      <input type="tel" id="phone" placeholder="0712345678" />
      <button class="pay-btn" id="payBtn" onclick="checkout()">Pay with M-Pesa</button>
      <div class="status" id="status"></div>
    </div>
  </div>

  <script>
    let products = [];
    const cart = {};

    async function loadProducts() {
      const res = await fetch('/api/products');
      products = await res.json();
      const container = document.getElementById('products');
      container.innerHTML = products.map(p =>
        '<div class="product">' +
        '<h3>' + p.name + '</h3>' +
        '<div class="price">KES ' + p.price.toLocaleString() + '</div>' +
        '<button onclick="addToCart(\'' + p.id + '\')">Add to Cart</button>' +
        '</div>'
      ).join('');
    }

    function addToCart(productId) {
      cart[productId] = (cart[productId] || 0) + 1;
      renderCart();
    }

    function renderCart() {
      const items = Object.entries(cart);
      if (items.length === 0) {
        document.getElementById('cartSection').style.display = 'none';
        document.getElementById('checkoutSection').style.display = 'none';
        return;
      }

      document.getElementById('cartSection').style.display = 'block';
      document.getElementById('checkoutSection').style.display = 'block';

      let total = 0;
      const html = items.map(([productId, qty]) => {
        const product = products.find(p => p.id === productId);
        const subtotal = product.price * qty;
        total += subtotal;
        return '<div class="cart-item"><span>' + product.name + ' x' + qty + '</span><span>KES ' + subtotal.toLocaleString() + '</span></div>';
      }).join('');

      document.getElementById('cartItems').innerHTML = html;
      document.getElementById('cartTotal').textContent = total.toLocaleString();
    }

    async function checkout() {
      const phone = document.getElementById('phone').value;
      const btn = document.getElementById('payBtn');

      if (!phone) {
        showStatus('Enter your M-Pesa phone number.', 'error');
        return;
      }

      const items = Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity }));

      btn.disabled = true;
      btn.textContent = 'Processing...';
      showStatus('Sending M-Pesa prompt to your phone. Enter your PIN when prompted.', 'loading');

      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, phone }),
        });
        const data = await res.json();

        if (data.success) {
          showStatus('Order confirmed! Order: ' + data.orderId + '. Receipt: ' + data.transactionId, 'success');
          btn.textContent = 'Order Placed';
          // Clear cart
          Object.keys(cart).forEach(k => delete cart[k]);
        } else {
          showStatus(data.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Pay with M-Pesa';
        }
      } catch (err) {
        showStatus('Network error. Please try again.', 'error');
        btn.disabled = false;
        btn.textContent = 'Pay with M-Pesa';
      }
    }

    function showStatus(message, type) {
      const el = document.getElementById('status');
      el.textContent = message;
      el.className = 'status ' + type;
    }

    loadProducts();
  </script>
</body>
</html>
```

## Order Management

The example above uses in-memory storage. In production, you need:

### Order Status Flow

```
pending  -->  paid     (payment succeeded)
pending  -->  failed   (payment failed or cancelled)
failed   -->  pending  (customer retries)
paid     -->  refunded (you issue a reversal)
```

### Database Schema (conceptual)

```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,          -- 'ORD-A1B2C3D4'
  total INTEGER NOT NULL,       -- amount in KES
  phone TEXT NOT NULL,          -- '254712345678'
  status TEXT NOT NULL,         -- 'pending', 'paid', 'failed', 'refunded'
  transaction_id TEXT,          -- M-Pesa receipt number
  created_at TIMESTAMP,
  paid_at TIMESTAMP
);

CREATE TABLE order_items (
  order_id TEXT REFERENCES orders(id),
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price INTEGER NOT NULL        -- price at time of purchase
);
```

### Linking Payments to Orders

The `reference` parameter in `mpesa.collect()` is set to the order ID. This lets you:
- Match M-Pesa transaction receipts to orders in your database.
- Look up order details from the M-Pesa SMS the customer receives.
- Use `mpesa.status()` to verify a payment against a specific order later.

## Production Considerations

1. **Database persistence.** Replace in-memory maps with a real database (PostgreSQL, MongoDB, etc.).
2. **Inventory management.** Check stock before accepting payment. Reserve items during payment processing.
3. **Order expiry.** Expire pending orders after a timeout (e.g., 30 minutes) and release reserved stock.
4. **Email/SMS confirmation.** Send order confirmation after successful payment.
5. **Refunds.** Use `mpesa.reverse()` to process refunds. Track refund status in your order table.
6. **Concurrency.** Handle concurrent purchases of the same item. Use database transactions for stock management.
