# Environments

Daraja has two environments: Sandbox (for testing) and Production (for live transactions). This document covers the differences and how to configure each.

## Comparison

| Aspect | Sandbox | Production |
|--------|---------|------------|
| **Base URL** | `https://sandbox.safaricom.co.ke` | `https://api.safaricom.co.ke` |
| **Credentials** | From portal sandbox app | Received via email after go-live |
| **Certificate** | `SandboxCertificate.cer` | `ProductionCertificate.cer` |
| **STK Push Shortcode** | `174379` | Your production shortcode |
| **STK Push Passkey** | Fixed sandbox passkey | Your production passkey (emailed) |
| **Test Phone** | `254708374149` | Real phone numbers |
| **Real Money** | No -- transactions are simulated | Yes -- real M-Pesa charges |
| **C2B Shortcode** | `600000` (sandbox) | Your registered PayBill/Till |
| **B2C Shortcode** | `600000` (sandbox) | Your production shortcode |
| **Initiator Name** | `testapi` | Your production initiator |
| **Initiator Password** | `Safaricom999!*!` | Your production initiator password |

## Sandbox

The sandbox is a testing environment that simulates M-Pesa transactions without moving real money.

### Key Details

- **Base URL:** `https://sandbox.safaricom.co.ke`
- **Test phone number:** `254708374149` -- STK Push to this number always succeeds in sandbox.
- **Default shortcode:** `174379` for STK Push. `600000` for C2B and B2C.
- **Behavior:** Transactions are simulated. No real money moves. The test phone does not receive actual STK prompts.
- **Reliability:** Sandbox can be intermittently slow or return inconsistent results. This is a known issue. Implement retries in your test suite.

### Getting Sandbox Credentials

1. Go to [developer.safaricom.co.ke](https://developer.safaricom.co.ke).
2. Sign up or log in.
3. Click "Add a New App" under My Apps.
4. Give your app a name and select the APIs you need.
5. The Consumer Key and Consumer Secret are shown on the app details page.

### Sandbox Configuration

```bash
# .env for sandbox
DARAJA_CONSUMER_KEY=your_sandbox_consumer_key
DARAJA_CONSUMER_SECRET=your_sandbox_consumer_secret
```

```typescript
import { createClient } from '@daraja-kit/sdk';

// Sandbox is the default -- no extra configuration needed
const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});
```

### Sandbox Test Values

| Parameter | Value |
|-----------|-------|
| STK Push Shortcode | `174379` |
| STK Push Passkey | `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919` |
| Initiator Name | `testapi` |
| Initiator Password | `Safaricom999!*!` |
| Test Phone | `254708374149` |
| C2B Shortcode | `600000` |
| B2C Shortcode | `600000` |

## Production

Production processes real M-Pesa transactions with real money.

### Key Details

- **Base URL:** `https://api.safaricom.co.ke`
- **Real phone numbers:** STK Push goes to actual phones. Real money moves.
- **Your shortcode:** Use your registered PayBill or Till Number.
- **Reliability:** Production is significantly more reliable than sandbox.

### Getting Production Credentials

Production credentials are not available on the developer portal. You receive them via email after completing the go-live process. See [Going Live](going-live.md).

You will receive:
- Production Consumer Key and Consumer Secret
- Production passkey (for STK Push)
- Initiator name and password (for B2C, Status, Balance, Reversal)

### Production Configuration

```bash
# .env for production
DARAJA_CONSUMER_KEY=your_production_consumer_key
DARAJA_CONSUMER_SECRET=your_production_consumer_secret
```

```typescript
import { createClient } from '@daraja-kit/sdk';

// For production, specify env: 'production'
const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
  // env: 'production',  // Uncomment for production
});
```

## Behavior Differences

Some things work differently between sandbox and production:

| Behavior | Sandbox | Production |
|----------|---------|------------|
| STK Push prompt | Not displayed on phone (simulated) | Customer sees real prompt on phone |
| Transaction speed | Can be slow or delayed | Usually completes in 5-30 seconds |
| Error responses | May return inconsistent errors | Consistent error codes |
| Callbacks | May be delayed or missing | Reliable delivery |
| Transaction limits | No enforced limits | M-Pesa limits apply (min KES 1, max KES 150,000 per STK) |
| Phone validation | `254708374149` always works | Must be a real, registered M-Pesa number |

## Switching Between Environments

Use environment variables to switch without code changes:

```bash
# .env.sandbox
DARAJA_CONSUMER_KEY=sandbox_key
DARAJA_CONSUMER_SECRET=sandbox_secret
NODE_ENV=development

# .env.production
DARAJA_CONSUMER_KEY=production_key
DARAJA_CONSUMER_SECRET=production_secret
NODE_ENV=production
```

```typescript
import { createClient } from '@daraja-kit/sdk';

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
  // env: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
});
```

## Tips

- **Always test in sandbox first.** Get your integration working end-to-end in sandbox before going live.
- **Sandbox is flaky.** If you get unexpected errors in sandbox, retry. Do not assume your code is broken just because sandbox returns an error.
- **Production verification:** After going live, test with small amounts (KES 1-10) to verify everything works before processing real customer payments.
- **Separate apps:** Create separate Daraja apps for sandbox and production. Do not reuse the same credentials.
