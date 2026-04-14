# Resilience Patterns

How to build M-Pesa integrations that handle failures gracefully. Covers retries, backoff, deduplication, and monitoring.

## Which Errors Are Retryable?

Not all errors should be retried. Retrying user-driven failures wastes resources and annoys customers.

| Category | Error Codes | Action |
|----------|------------|--------|
| **Retryable (transient)** | 05, 11, 29, HTTP 429, 500, 503 | Retry with exponential backoff |
| **Not retryable (user action needed)** | 1 (insufficient funds), 1032 (cancelled), 08 (daily limit), 10 (not registered) | Show user-friendly message, offer retry button |
| **Not retryable (code fix needed)** | 03, 04, 12, 36, 41, 42 | Fix your code — wrong parameters or credentials |
| **Cooldown required** | 35 (duplicate) | Wait 30 seconds before retrying same phone + amount |

## Exponential Backoff Pattern

```typescript
import { createClient } from '@daraja-kit/sdk';

const mpesa = createClient();

const RETRYABLE_CODES = new Set(['05', '11', '29', 'SYSTEM_ERROR', 'SYSTEM_DOWNTIME', 'TIMEOUT']);

async function collectWithRetry(options, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await mpesa.collect(options);
    } catch (err) {
      const isRetryable =
        RETRYABLE_CODES.has(err.darajaCode) ||
        RETRYABLE_CODES.has(err.code) ||
        (err.httpStatus && err.httpStatus >= 500);

      if (!isRetryable || attempt === maxAttempts) {
        throw err; // Not retryable, or exhausted attempts
      }

      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // 1s, 2s, 4s... max 30s
      console.log(`Attempt ${attempt} failed (${err.code}), retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
```

## Duplicate Transaction Prevention (Error 35)

Daraja rejects transactions with the same phone + amount within ~30 seconds. This catches naive retry logic.

```typescript
const recentRequests = new Map();

function checkDuplicate(phone, amount) {
  const key = `${phone}:${amount}`;
  const lastTime = recentRequests.get(key);
  const now = Date.now();

  if (lastTime && now - lastTime < 30_000) {
    return { isDuplicate: true, waitMs: 30_000 - (now - lastTime) };
  }

  recentRequests.set(key, now);
  return { isDuplicate: false };
}

// Usage in your endpoint:
app.post('/api/pay', async (req, res) => {
  const { phone, amount } = req.body;
  const dup = checkDuplicate(phone, amount);

  if (dup.isDuplicate) {
    return res.status(429).json({
      error: 'Please wait before retrying',
      retryAfterMs: dup.waitMs,
    });
  }

  try {
    const result = await mpesa.collect({ amount, phone });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message, suggestion: err.suggestion });
  }
});
```

## Circuit Breaker Pattern

When Daraja is down (error 29, repeated 500s), stop hammering the API and fail fast.

```typescript
let failures = 0;
let circuitOpen = false;
let circuitResetTime = 0;

const FAILURE_THRESHOLD = 3;
const RESET_TIMEOUT_MS = 60_000; // 1 minute

async function collectWithCircuitBreaker(options) {
  // Check if circuit is open
  if (circuitOpen) {
    if (Date.now() > circuitResetTime) {
      circuitOpen = false; // Try again (half-open)
      failures = 0;
    } else {
      throw new Error('M-Pesa service temporarily unavailable. Please try again in a minute.');
    }
  }

  try {
    const result = await mpesa.collect(options);
    failures = 0; // Reset on success
    return result;
  } catch (err) {
    if (err.httpStatus >= 500 || err.darajaCode === '29') {
      failures++;
      if (failures >= FAILURE_THRESHOLD) {
        circuitOpen = true;
        circuitResetTime = Date.now() + RESET_TIMEOUT_MS;
        console.error('Circuit breaker OPEN — pausing M-Pesa requests for 60s');
      }
    }
    throw err;
  }
}
```

## What to Log in Production

Track these fields on every M-Pesa transaction for debugging and monitoring:

```typescript
function logTransaction(action, options, result, error, durationMs) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,               // 'collect', 'send', 'status', etc.
    phone: options.phone,
    amount: options.amount,
    durationMs,
    status: error ? 'error' : result?.status,
    resultCode: error?.darajaCode || result?.raw?.ResultCode,
    errorCode: error?.code,
    receipt: result?.receipt,
  };
  console.log(JSON.stringify(entry));
}
```

**Key metrics to alert on:**
- Error rate > 5% over 5 minutes (something is wrong)
- Average latency > 30 seconds (Daraja may be degraded)
- Any error 29 (system downtime — activate circuit breaker)
- Error 35 count increasing (your retry logic may be too aggressive)
