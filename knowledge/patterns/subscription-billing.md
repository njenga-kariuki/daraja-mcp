# Pattern: Subscription Billing

Implement recurring M-Pesa payments for subscriptions, memberships, or monthly services.

## The Challenge

M-Pesa does not have native subscription or recurring payment support. You cannot set up automatic monthly debits from a customer's M-Pesa wallet. Every payment requires the customer to actively enter their PIN.

## The Approach

1. Store subscriber details: phone number, plan, billing date, status.
2. Run a scheduled job (cron) on each subscriber's billing date.
3. The job calls `mpesa.collect()` to send an STK Push to the subscriber's phone.
4. If the subscriber enters their PIN, the payment is collected.
5. If the payment fails (cancelled, phone off, insufficient funds), implement retry logic.
6. After max retries, mark the subscription as lapsed and notify the subscriber.

## Complete Code

### Subscriber Management (server.ts)

```typescript
import express from 'express';
import { createClient } from '@daraja-kit/sdk';

const app = express();
app.use(express.json());

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});

// --- Types ---
interface Subscriber {
  id: string;
  phone: string;
  plan: 'basic' | 'premium';
  amount: number;
  status: 'active' | 'past_due' | 'lapsed' | 'cancelled';
  nextBillingDate: Date;
  retryCount: number;
  lastPaymentDate?: Date;
  lastTransactionId?: string;
}

// --- In-memory store (use a database in production) ---
const subscribers = new Map<string, Subscriber>();

const PLANS: Record<string, number> = {
  basic: 500,
  premium: 1500,
};

const MAX_RETRIES = 3;
const RETRY_INTERVALS_HOURS = [1, 6, 24]; // Retry after 1h, 6h, 24h

// --- Subscribe Endpoint ---
app.post('/api/subscribe', async (req, res) => {
  const { phone, plan } = req.body;

  if (!phone || !plan) {
    return res.status(400).json({ success: false, message: 'Phone and plan are required.' });
  }

  const normalizedPhone = phone.replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
  const amount = PLANS[plan];

  if (!amount) {
    return res.status(400).json({ success: false, message: 'Invalid plan. Choose basic or premium.' });
  }

  // Collect first payment immediately
  try {
    const result = await mpesa.collect({
      amount,
      phone: normalizedPhone,
      reference: `SUB-${plan.toUpperCase()}`,
      description: 'Subscription',
      pollTimeout: 70000,
    });

    if (result.status === 'success') {
      const id = `sub_${Date.now()}`;
      const nextBilling = new Date();
      nextBilling.setMonth(nextBilling.getMonth() + 1);

      const subscriber: Subscriber = {
        id,
        phone: normalizedPhone,
        plan: plan as 'basic' | 'premium',
        amount,
        status: 'active',
        nextBillingDate: nextBilling,
        retryCount: 0,
        lastPaymentDate: new Date(),
        lastTransactionId: result.transactionId,
      };

      subscribers.set(id, subscriber);

      return res.json({
        success: true,
        message: `Subscribed to ${plan} plan. Next billing: ${nextBilling.toDateString()}.`,
        subscriberId: id,
        transactionId: result.transactionId,
      });
    }

    return res.json({
      success: false,
      message: `Payment failed: ${result.errorMessage || 'Unknown error'}. Subscription not created.`,
    });
  } catch (error) {
    console.error('Subscription payment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Payment service unavailable. Try again later.',
    });
  }
});

// --- Cancel Subscription ---
app.post('/api/subscribe/:id/cancel', (req, res) => {
  const subscriber = subscribers.get(req.params.id);
  if (!subscriber) {
    return res.status(404).json({ success: false, message: 'Subscriber not found.' });
  }

  subscriber.status = 'cancelled';
  subscribers.set(subscriber.id, subscriber);

  return res.json({
    success: true,
    message: 'Subscription cancelled. You will not be billed again.',
  });
});

// --- Get Subscriber Info ---
app.get('/api/subscribe/:id', (req, res) => {
  const subscriber = subscribers.get(req.params.id);
  if (!subscriber) {
    return res.status(404).json({ success: false, message: 'Subscriber not found.' });
  }
  return res.json({ success: true, subscriber });
});

app.listen(3000, () => console.log('Subscription server running on port 3000'));
```

### Billing Job (billing.ts)

```typescript
import { createClient } from '@daraja-kit/sdk';

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});

// In production, replace with your database queries
import { subscribers } from './store'; // Shared subscriber store

const MAX_RETRIES = 3;

/**
 * Process billing for all subscribers due today.
 * Run this function daily via cron (e.g., node-cron, Railway cron, or system crontab).
 */
export async function processBilling(): Promise<void> {
  const now = new Date();
  const dueSubscribers: Array<{ id: string; phone: string; plan: string; amount: number }> = [];

  // Find subscribers due for billing
  for (const [id, subscriber] of subscribers.entries()) {
    if (subscriber.status === 'cancelled') continue;
    if (subscriber.status === 'lapsed') continue;
    if (subscriber.nextBillingDate > now) continue;

    dueSubscribers.push({
      id,
      phone: subscriber.phone,
      plan: subscriber.plan,
      amount: subscriber.amount,
    });
  }

  console.log(`Billing run: ${dueSubscribers.length} subscribers due.`);

  // Process each subscriber sequentially to avoid rate limits
  for (const sub of dueSubscribers) {
    await billSubscriber(sub.id);
  }
}

async function billSubscriber(subscriberId: string): Promise<void> {
  const subscriber = subscribers.get(subscriberId);
  if (!subscriber) return;

  console.log(`Billing ${subscriberId}: KES ${subscriber.amount} to ${subscriber.phone}`);

  try {
    const result = await mpesa.collect({
      amount: subscriber.amount,
      phone: subscriber.phone,
      reference: `SUB-${subscriber.plan.toUpperCase()}`,
      description: 'Subscription',
      pollTimeout: 70000,
    });

    if (result.status === 'success') {
      // Payment succeeded -- renew subscription
      const nextBilling = new Date();
      nextBilling.setMonth(nextBilling.getMonth() + 1);

      subscriber.status = 'active';
      subscriber.nextBillingDate = nextBilling;
      subscriber.retryCount = 0;
      subscriber.lastPaymentDate = new Date();
      subscriber.lastTransactionId = result.transactionId;
      subscribers.set(subscriberId, subscriber);

      console.log(`  Success: ${result.transactionId}. Next billing: ${nextBilling.toDateString()}`);

      // TODO: Send confirmation SMS/email to subscriber
    } else {
      // Payment failed -- schedule retry or lapse
      handleBillingFailure(subscriberId, result.errorCode);
    }
  } catch (error) {
    console.error(`  Error billing ${subscriberId}:`, error);
    handleBillingFailure(subscriberId, 'unknown');
  }
}

function handleBillingFailure(subscriberId: string, errorCode?: string): void {
  const subscriber = subscribers.get(subscriberId);
  if (!subscriber) return;

  subscriber.retryCount += 1;

  if (subscriber.retryCount >= MAX_RETRIES) {
    // Max retries reached -- lapse the subscription
    subscriber.status = 'lapsed';
    subscribers.set(subscriberId, subscriber);

    console.log(`  Lapsed: ${subscriberId} after ${MAX_RETRIES} failed attempts.`);

    // TODO: Send "subscription lapsed" notification to subscriber
    // TODO: Disable access to subscription features
  } else {
    // Schedule retry
    subscriber.status = 'past_due';
    subscribers.set(subscriberId, subscriber);

    console.log(`  Failed (${errorCode}). Retry ${subscriber.retryCount}/${MAX_RETRIES}.`);

    // TODO: Send "payment failed, please ensure M-Pesa is funded" SMS to subscriber
  }
}
```

### Scheduling with node-cron

```typescript
import cron from 'node-cron';
import { processBilling } from './billing';

// Run billing every day at 9:00 AM EAT (6:00 AM UTC)
cron.schedule('0 6 * * *', async () => {
  console.log('Starting daily billing run...');
  await processBilling();
  console.log('Billing run complete.');
});

// Also run retry billing at 3:00 PM EAT (12:00 PM UTC) for past_due subscribers
cron.schedule('0 12 * * *', async () => {
  console.log('Starting retry billing run...');
  await processBilling(); // processBilling naturally picks up past_due subscribers
  console.log('Retry billing run complete.');
});
```

## Retry Strategy

| Attempt | Timing | Action on Failure |
|---------|--------|-------------------|
| 1st (initial) | Billing date, 9 AM | Mark as past_due. Send "payment failed" SMS. |
| 2nd (retry 1) | Same day, 3 PM | Send "please fund your M-Pesa" SMS. |
| 3rd (retry 2) | Next day, 9 AM | Last attempt. Send "subscription will lapse" SMS. |
| After 3rd | -- | Mark as lapsed. Disable access. Send "subscription expired" SMS. |

## Reactivation

Allow lapsed subscribers to reactivate by paying again:

```typescript
app.post('/api/subscribe/:id/reactivate', async (req, res) => {
  const subscriber = subscribers.get(req.params.id);
  if (!subscriber) {
    return res.status(404).json({ success: false, message: 'Subscriber not found.' });
  }

  if (subscriber.status !== 'lapsed' && subscriber.status !== 'cancelled') {
    return res.json({ success: false, message: 'Subscription is already active.' });
  }

  try {
    const result = await mpesa.collect({
      amount: subscriber.amount,
      phone: subscriber.phone,
      reference: `SUB-${subscriber.plan.toUpperCase()}`,
      description: 'Subscription',
      pollTimeout: 70000,
    });

    if (result.status === 'success') {
      const nextBilling = new Date();
      nextBilling.setMonth(nextBilling.getMonth() + 1);

      subscriber.status = 'active';
      subscriber.nextBillingDate = nextBilling;
      subscriber.retryCount = 0;
      subscriber.lastPaymentDate = new Date();
      subscriber.lastTransactionId = result.transactionId;
      subscribers.set(subscriber.id, subscriber);

      return res.json({
        success: true,
        message: `Subscription reactivated! Next billing: ${nextBilling.toDateString()}.`,
      });
    }

    return res.json({
      success: false,
      message: `Payment failed. ${result.errorMessage || 'Please try again.'}`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Payment service unavailable.' });
  }
});
```

## Production Considerations

1. **Database.** Store subscribers in a real database. The in-memory store above is for demonstration only.
2. **Notifications.** Send SMS (Africa's Talking, Twilio) or email at each billing event: success, failure, retry, lapse.
3. **Grace period.** Consider giving a 3-7 day grace period after first failure before disabling access.
4. **Billing time.** Bill in the morning (9 AM local time) when customers are likely to have their phone on and funded.
5. **Rate limiting.** Process subscribers sequentially with short delays between calls to avoid Daraja rate limits.
6. **Idempotency.** Track billing attempts in your database. If the billing job crashes mid-run, it should not double-charge on restart.
7. **Plan changes.** Allow customers to upgrade/downgrade. Prorate the difference or apply the new amount at the next billing cycle.
8. **Receipts.** Keep a complete payment history per subscriber for accounting and support.
