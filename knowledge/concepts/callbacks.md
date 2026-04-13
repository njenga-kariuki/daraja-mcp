# Callbacks

Complete reference on Daraja's asynchronous callback pattern: how callbacks work, which APIs need them, how to set them up, and how to handle them securely.

## Why Callbacks

Daraja processes most transactions asynchronously. When you submit a request (B2C payment, reversal, status query, balance check), Daraja accepts it immediately but processes it in the background. When processing completes, Daraja sends the result to a URL you provided -- your callback URL.

Think of it as: "I will call you back when I have the answer."

## Which APIs Need Callbacks

| API | Callback Required? | Alternative |
|-----|-------------------|-------------|
| STK Push (collect) | No | SDK polls automatically with `poll: true` (default) |
| B2C (send) | **Yes** | None -- callback is the only way to get the result |
| Transaction Status | **Yes** | None |
| Account Balance | **Yes** | None |
| Reversal | **Yes** | None |
| C2B (register URLs) | **Yes** | None -- validation and confirmation URLs are callback URLs |
| B2B | **Yes** | None |

**STK Push is the exception.** The SDK handles STK Push results via polling, so you do not need a callback URL for `mpesa.collect()`. All other APIs require a callback.

## Callback URL Requirements

Your callback URL must meet these requirements:

| Requirement | Details |
|-------------|---------|
| **HTTPS** | Must use HTTPS (not HTTP). Daraja will not call HTTP URLs. |
| **Valid SSL certificate** | Must have a valid, non-expired SSL certificate. Self-signed certificates will not work. |
| **Publicly reachable** | Must be accessible from the internet. Daraja's servers need to reach your URL. |
| **No IP addresses** | Use a domain name, not an IP address (e.g., `https://api.yoursite.com`, not `https://1.2.3.4`). |
| **Returns HTTP 200** | Must return a 200 status code. Daraja may retry if it receives an error status. |
| **Responds quickly** | Process the callback and respond within a few seconds. Do heavy processing asynchronously. |

## Local Development

During development, your localhost is not reachable from the internet. Use a tunneling tool to expose your local server.

### ngrok (Recommended)

```bash
# Install ngrok
brew install ngrok     # macOS
# or download from https://ngrok.com

# Start your Express server
node server.js         # listening on port 3000

# In another terminal, start ngrok
ngrok http 3000
```

ngrok gives you a public HTTPS URL like `https://abc123.ngrok-free.app`. Use this as your callback base URL:

```bash
# .env
MPESA_CALLBACK_BASE_URL=https://abc123.ngrok-free.app
```

```typescript
const result = await mpesa.send({
  amount: 100,
  phone: '254712345678',
  callbackUrl: `${process.env.MPESA_CALLBACK_BASE_URL}/api/b2c/callback`,
});
```

**Note:** The ngrok URL changes every time you restart ngrok (unless you have a paid plan with a fixed domain). Update your `.env` accordingly.

### cloudflared (Alternative)

```bash
# Install cloudflared
brew install cloudflared

# Expose port 3000
cloudflared tunnel --url http://localhost:3000
```

This gives you a URL like `https://random-words.trycloudflare.com`. Use it the same way as ngrok.

## Callback Response Format

When Daraja calls your URL, you MUST respond with this JSON body:

```json
{
  "ResultCode": 0,
  "ResultDesc": "Accepted"
}
```

This tells Daraja you received the callback. If you do not respond correctly, Daraja may retry the callback or mark your URL as unresponsive.

## Callback Payload Structure

All Daraja callbacks follow a similar structure:

```json
{
  "Result": {
    "ResultType": 0,
    "ResultCode": 0,
    "ResultDesc": "The service request is processed successfully.",
    "OriginatorConversationID": "16740-34861180-1",
    "ConversationID": "AG_20191219_00004e48cf7e3533f581",
    "TransactionID": "SBJ7TLTQA2",
    "ResultParameters": {
      "ResultParameter": [
        { "Key": "SomeKey", "Value": "SomeValue" },
        { "Key": "AnotherKey", "Value": 12345 }
      ]
    }
  }
}
```

- **ResultCode 0** means success. Any other code means failure.
- **ResultParameters** contains the transaction-specific data as key-value pairs.
- The specific keys in ResultParameters vary by API (see each capability's documentation).

## Security

Daraja does NOT sign callbacks. There is no built-in way to verify that a callback genuinely came from Safaricom. You should implement your own security measures:

### 1. IP Whitelisting

Restrict your callback endpoints to only accept requests from Safaricom's IP ranges. Known Safaricom API IPs include:

```typescript
const SAFARICOM_IPS = [
  '196.201.214.200',
  '196.201.214.206',
  '196.201.213.114',
  '196.201.214.207',
  '196.201.214.208',
  '196.201.213.44',
  '196.201.212.127',
  '196.201.212.138',
  '196.201.212.129',
  '196.201.212.136',
  '196.201.212.74',
  '196.201.212.69',
];

function isSafaricomIP(ip: string): boolean {
  // Handle proxied requests (X-Forwarded-For)
  return SAFARICOM_IPS.includes(ip);
}
```

**Important:** These IPs may change. Verify current IPs with Safaricom or check your callback logs.

### 2. Request Validation

Validate the structure and content of callbacks:

```typescript
function validateCallback(body: any): boolean {
  // Check required fields exist
  if (!body?.Result) return false;
  if (typeof body.Result.ResultCode !== 'number') return false;
  if (!body.Result.ConversationID) return false;

  // Check ConversationID matches one you initiated
  // (requires storing conversation IDs when you make requests)
  return true;
}
```

### 3. Idempotency

Daraja may send the same callback more than once (retries). Protect against duplicate processing:

```typescript
const processedCallbacks = new Set<string>();

function handleCallback(body: any) {
  const conversationId = body.Result.ConversationID;

  // Skip if already processed
  if (processedCallbacks.has(conversationId)) {
    console.log(`Duplicate callback ignored: ${conversationId}`);
    return;
  }

  processedCallbacks.add(conversationId);

  // Process the callback...
  // In production, use a database instead of an in-memory Set
}
```

## Complete Express Callback Handler

```typescript
import express from 'express';

const app = express();
app.use(express.json());

// --- Middleware: IP Whitelist (optional but recommended) ---
const SAFARICOM_IPS = [
  '196.201.214.200', '196.201.214.206', '196.201.213.114',
  '196.201.214.207', '196.201.214.208', '196.201.213.44',
  '196.201.212.127', '196.201.212.138', '196.201.212.129',
  '196.201.212.136', '196.201.212.74', '196.201.212.69',
];

function safaricomOnly(req: express.Request, res: express.Response, next: express.NextFunction) {
  const clientIP = req.ip || req.socket.remoteAddress || '';
  const forwardedFor = req.headers['x-forwarded-for'] as string || '';
  const sourceIP = forwardedFor.split(',')[0].trim() || clientIP;

  // In development, allow all IPs
  if (process.env.NODE_ENV === 'development') return next();

  if (!SAFARICOM_IPS.includes(sourceIP)) {
    console.warn(`Blocked callback from non-Safaricom IP: ${sourceIP}`);
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}

// --- B2C Callback ---
app.post('/api/b2c/callback', safaricomOnly, (req, res) => {
  const { Result } = req.body;

  console.log('B2C Result:', JSON.stringify(Result, null, 2));

  if (Result.ResultCode === 0) {
    const params = Result.ResultParameters.ResultParameter;
    const receipt = params.find((p: any) => p.Key === 'TransactionReceipt')?.Value;
    const amount = params.find((p: any) => p.Key === 'TransactionAmount')?.Value;

    // TODO: Update your database
    console.log(`B2C success: KES ${amount}, receipt ${receipt}`);
  } else {
    console.error(`B2C failed: ${Result.ResultCode} - ${Result.ResultDesc}`);
  }

  // Always respond to Daraja
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// --- Reversal Callback ---
app.post('/api/reversal/callback', safaricomOnly, (req, res) => {
  const { Result } = req.body;

  console.log('Reversal Result:', JSON.stringify(Result, null, 2));

  if (Result.ResultCode === 0) {
    console.log('Reversal successful:', Result.TransactionID);
  } else {
    console.error(`Reversal failed: ${Result.ResultCode} - ${Result.ResultDesc}`);
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// --- Status Callback ---
app.post('/api/status/callback', safaricomOnly, (req, res) => {
  const { Result } = req.body;

  console.log('Status Result:', JSON.stringify(Result, null, 2));

  // Process status result...

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// --- Balance Callback ---
app.post('/api/balance/callback', safaricomOnly, (req, res) => {
  const { Result } = req.body;

  console.log('Balance Result:', JSON.stringify(Result, null, 2));

  // Process balance result...

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// --- Generic Timeout Handler ---
app.post('/api/timeout', safaricomOnly, (req, res) => {
  console.warn('Daraja timeout:', JSON.stringify(req.body, null, 2));

  // TODO: Queue for retry or manual review

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.listen(3000, () => console.log('Callback server running on port 3000'));
```

## Debugging Callbacks

If callbacks never arrive:

1. **Check your URL is reachable.** Open it in a browser or curl it from another machine.
2. **Check HTTPS.** Daraja requires HTTPS with a valid SSL cert.
3. **Check ngrok is running.** If using ngrok, ensure the tunnel is active.
4. **Check your server logs.** Look for incoming POST requests.
5. **Check firewall rules.** Ensure your server allows inbound HTTPS from Safaricom IPs.
6. **Check Daraja response.** The initial API response includes `responseCode: '0'` if the request was accepted. If you get an error here, the callback was never scheduled.
7. **Sandbox behavior.** Sandbox callbacks can be delayed or occasionally not delivered. Retry the request.
