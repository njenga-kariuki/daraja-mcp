# Authentication

Complete reference on Daraja API authentication: OAuth tokens, SecurityCredential encryption, and certificate management.

## Overview

Daraja uses two authentication mechanisms:

1. **OAuth 2.0 Access Tokens** -- required for every API call. Generated from your consumer key and secret.
2. **SecurityCredential** -- required for B2C, Transaction Status, Account Balance, and Reversal APIs. RSA-encrypted initiator password.

The SDK handles both automatically. This document explains how they work under the hood.

## OAuth 2.0 Access Tokens

### How It Works

1. Combine your consumer key and secret as `key:secret`.
2. Base64-encode the combined string.
3. Send a GET request to the token endpoint with `Authorization: Basic <base64>`.
4. Receive an access token valid for 3599 seconds (approximately 1 hour).
5. Include the token in all subsequent API calls as `Authorization: Bearer <token>`.

### Token Endpoint

| Environment | URL |
|-------------|-----|
| Sandbox | `https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials` |
| Production | `https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials` |

### Token Lifetime and Caching

- Tokens are valid for **3599 seconds** (just under 1 hour).
- The SDK caches tokens automatically and refreshes them **60 seconds before expiry**.
- You never need to manually manage tokens when using the SDK.

### SDK Approach (Automatic)

```typescript
import { createClient } from '@daraja-kit/sdk';

// The SDK handles OAuth automatically.
// Just provide your consumer key and secret.
const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});

// Every method call automatically includes a valid Bearer token.
const result = await mpesa.collect({ amount: 100, phone: '254712345678' });
```

### Manual Approach

```typescript
// If you need to get a token manually (e.g., for B2B or custom API calls):

async function getAccessToken(): Promise<string> {
  const consumerKey = process.env.DARAJA_CONSUMER_KEY!;
  const consumerSecret = process.env.DARAJA_CONSUMER_SECRET!;

  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  const response = await fetch(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`OAuth failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { access_token: string; expires_in: string };
  return data.access_token;
}

// Usage:
const token = await getAccessToken();
// Use in API calls: headers: { Authorization: `Bearer ${token}` }
```

### OAuth Response

```json
{
  "access_token": "cXlKc2J2aGRkYXc4ZDhoZWRoYTk4...",
  "expires_in": "3599"
}
```

### Common OAuth Errors

| Error | Cause | Fix |
|-------|-------|-----|
| HTTP 401 "Invalid Credentials" | Wrong consumer key or secret | Regenerate credentials at developer.safaricom.co.ke |
| HTTP 400 "Bad Request" | Malformed authorization header | Ensure base64 encoding is correct, format is `key:secret` |
| HTTP 403 "Access Denied" | App not authorized for this API | Check your app's API subscriptions on the portal |

## SecurityCredential

### What It Is

SecurityCredential is an RSA-encrypted version of your initiator password. It is required by APIs that perform sensitive operations: B2C payments, Transaction Status queries, Account Balance checks, and Reversals.

### How It Works

1. Take your initiator password (a plaintext string).
2. Load Safaricom's public certificate (PEM format).
3. RSA-encrypt the password using PKCS#1 v1.5 padding.
4. Base64-encode the encrypted result.
5. Send the base64 string as the `SecurityCredential` parameter.

### SDK Approach (Automatic)

```typescript
// The SDK generates SecurityCredential automatically for all APIs that need it.
// You don't need to handle encryption or certificates.

const result = await mpesa.send({
  amount: 500,
  phone: '254712345678',
  callbackUrl: 'https://yourdomain.com/api/b2c/callback',
});
// SecurityCredential was generated behind the scenes.
```

### Manual Approach

```typescript
import crypto from 'crypto';
import fs from 'fs';

function generateSecurityCredential(password: string, certPath: string): string {
  const certificate = fs.readFileSync(certPath, 'utf-8');

  const encrypted = crypto.publicEncrypt(
    {
      key: certificate,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(password)
  );

  return encrypted.toString('base64');
}

// Usage:
const credential = generateSecurityCredential(
  'Safaricom999!*!',              // Initiator password (sandbox default)
  './certs/SandboxCertificate.cer' // Path to Safaricom's public cert
);
```

## Certificates

Safaricom provides two public certificates for SecurityCredential encryption:

| Certificate | Environment | File Name |
|-------------|-------------|-----------|
| Sandbox | Sandbox/testing | `SandboxCertificate.cer` |
| Production | Live/production | `ProductionCertificate.cer` |

**The SDK auto-discovers the cert at `~/.daraja/sandbox.cer` or `MPESA_CERT_PATH`** — you download it once and drop it at a stable path, then every project using the SDK picks it up. STK Push (collect) and QR do not require the cert; only B2C, Status, Balance, and Reversal do.

### One-time setup

```bash
# 1. Download SandboxCertificate.cer from developer.safaricom.co.ke →
#    your app → Keys tab (some portal versions list it under Documentation).
# 2. Drop it at the canonical path the SDK looks for:
mkdir -p ~/.daraja
mv ~/Downloads/SandboxCertificate.cer ~/.daraja/sandbox.cer
```

Alternatively, keep the cert anywhere and export the path:
```bash
export MPESA_CERT_PATH=/secure/path/to/SandboxCertificate.cer
```

### Cert resolution order

The SDK looks for the sandbox cert in this order and uses the first that exists:

1. `opts.certPath` passed to `createClient({ certPath })`
2. `MPESA_CERT_PATH` environment variable
3. `~/.daraja/sandbox.cer`
4. `./certs/sandbox.cer` relative to your process cwd
5. `packages/sdk/certs/sandbox.cer` inside the SDK install (for monorepo dev)

If none exist, the SDK throws `CERT_NOT_FOUND` with these exact setup steps in the error message — only when a B2C-family method is actually called.

### Where to Get Certificates

- **Sandbox:** `developer.safaricom.co.ke` → your app → Keys tab → download `SandboxCertificate.cer`.
- **Production:** Provided by Safaricom during the go-live process, or from the same Keys tab once your production app is approved.

### Common Certificate Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "SecurityCredential error" | Using sandbox cert in production or vice versa | Match the certificate to your environment |
| "error:0906D06C:PEM routines" | Corrupted or wrong format certificate | Re-download the certificate from the portal |
| "Invalid initiator credentials" (2001) | Wrong initiator password or name | For sandbox: initiator = `testapi`, password = `Safaricom999!*!` |

## Environment Variables

The SDK reads these environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DARAJA_CONSUMER_KEY` | Yes | Your app's consumer key from developer.safaricom.co.ke |
| `DARAJA_CONSUMER_SECRET` | Yes | Your app's consumer secret from developer.safaricom.co.ke |

### Setting Up

```bash
# .env file
DARAJA_CONSUMER_KEY=your_consumer_key_here
DARAJA_CONSUMER_SECRET=your_consumer_secret_here
```

```typescript
// Load environment variables (e.g., with dotenv)
import 'dotenv/config';
import { createClient } from '@daraja-kit/sdk';

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});
```

### Getting Credentials

1. Go to [developer.safaricom.co.ke](https://developer.safaricom.co.ke).
2. Sign up or log in.
3. Create a new app under "My Apps".
4. Select the APIs you need (Lipa Na M-Pesa, B2C, Transaction Status, etc.).
5. Copy the Consumer Key and Consumer Secret from the app details page.
6. For sandbox, credentials work immediately. For production, you need to go through the go-live process.

## Summary

| Mechanism | Used By | SDK Handles It? |
|-----------|---------|-----------------|
| OAuth 2.0 Bearer Token | All APIs | Yes -- cached, auto-refreshed |
| SecurityCredential (RSA) | B2C, Status, Balance, Reversal | Yes -- auto-generated per request |
| STK Push Password | STK Push (Lipa Na M-Pesa) | Yes -- generated from shortcode + passkey + timestamp |

You should never need to manually handle authentication when using `@daraja-kit/sdk`. The information above is for understanding what happens under the hood and for debugging authentication issues.
