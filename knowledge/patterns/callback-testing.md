# Callback Testing & Troubleshooting

Action-oriented guide for testing and debugging M-Pesa callback URLs. Use this when callbacks aren't arriving or you need to set up local development.

## Which APIs Need Callbacks?

| API | Callback Required? |
|-----|-------------------|
| STK Push (collect) | No — the SDK polls automatically |
| B2C (send) | Yes |
| Transaction Status | Yes |
| Account Balance | Yes |
| Reversal | Yes |
| QR Code | No |

## "My Callback Never Arrived" — Diagnostic Steps

Follow these steps in order. Most callback issues are caught by steps 1-3.

### Step 1: Check your URL is publicly reachable

```bash
# From your terminal, test your callback URL:
curl -X POST https://your-callback-url.com/api/callback \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**If this fails:** Your URL is not publicly reachable. See "Setting Up Local Development" below.

### Step 2: Check HTTPS

Daraja **requires HTTPS** with a valid SSL certificate. Common failures:
- Using `http://` instead of `https://`
- Self-signed certificate (Daraja rejects these)
- Expired certificate
- Using an IP address instead of a domain name

### Step 3: Check your response format

Daraja expects your callback endpoint to return this exact JSON:

```json
{ "ResultCode": 0, "ResultDesc": "Accepted" }
```

**If your endpoint returns anything else** (HTML error page, empty response, wrong status code), Daraja may retry or mark the transaction as failed.

```typescript
// Correct callback handler:
app.post('/api/callback', (req, res) => {
  console.log('Callback received:', JSON.stringify(req.body, null, 2));

  // Process the callback data...
  const result = req.body.Result;
  console.log('ResultCode:', result.ResultCode);
  console.log('ResultDesc:', result.ResultDesc);

  // ALWAYS respond with this format:
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
```

### Step 4: Check your server responds quickly

Daraja has a timeout for callbacks. If your endpoint takes too long (doing database writes, external API calls, etc.), Daraja may time out.

**Fix:** Acknowledge the callback immediately, then process async:

```typescript
app.post('/api/callback', (req, res) => {
  // Respond FIRST
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  // Process AFTER responding
  processCallbackAsync(req.body).catch(console.error);
});
```

### Step 5: Check firewall and hosting

- Is your server behind a firewall that blocks incoming POST requests?
- Is your cloud provider (Railway, Render, Vercel) configured to accept POST requests at that path?
- For Vercel/Netlify: serverless functions have cold start delays — use a persistent server (Railway, Render, Fly.io) for callbacks.

## Setting Up Local Development

For local development, you need a tunnel that makes your localhost accessible from the internet.

### Option 1: ngrok (recommended)

```bash
# Install ngrok
npm install -g ngrok
# Or: brew install ngrok

# Start your app
npm start  # Starts on port 3000

# In a new terminal, start ngrok
npx ngrok http 3000
```

ngrok will display a URL like `https://abc123.ngrok-free.app`. Use this as your callback base URL:

```bash
export MPESA_CALLBACK_BASE_URL=https://abc123.ngrok-free.app
```

### Option 2: cloudflared

```bash
# Install cloudflared
brew install cloudflared

# Start tunnel
cloudflared tunnel --url http://localhost:3000
```

### Important Notes for Local Testing

- ngrok URLs change every time you restart (unless you have a paid plan)
- Update your callback URL in your code/environment each time
- ngrok free tier has request limits — sufficient for testing
- The SDK's STK Push (collect) does **not** need callbacks — you can test payments locally without ngrok

## Callback Debugging Template

Add this to your server during development to log all incoming callbacks:

```typescript
// Debug middleware — log all callback requests
app.use('/api/callback', (req, res, next) => {
  console.log('=== CALLBACK RECEIVED ===');
  console.log('Time:', new Date().toISOString());
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('========================');
  next();
});
```

## Verifying Callback URL with daraja_preflight

Use the `daraja_preflight` MCP tool to verify your callback URL is reachable before making API calls:

```
daraja_preflight({ code: yourCode, callbackUrl: 'https://your-url.com/api/callback' })
```

This will test whether the URL responds to HTTP requests, catching configuration issues before they cause transaction failures.
