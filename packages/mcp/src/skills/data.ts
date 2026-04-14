/**
 * Agent Skills data — inline definitions for bundling with tsup.
 */

export interface Skill {
  name: string;
  version: string;
  description: string;
  instructions: Array<{ category: string; rules: string[] }>;
  metadata: Record<string, string>;
}

export const bestPractices: Skill = {
  name: 'daraja-best-practices',
  version: '1.0.0',
  description:
    'Best practices for M-Pesa Daraja API integration using the @daraja-kit/sdk. Guides agents on SDK usage, credential handling, error patterns, phone formatting, and callback requirements.',
  instructions: [
    {
      category: 'SDK Usage',
      rules: [
        'Always use `createClient()` from `@daraja-kit/sdk` to create an M-Pesa client. Never make raw HTTP calls to the Daraja API.',
        'The SDK provides 6 methods: `collect()` (STK Push), `send()` (B2C), `status()`, `balance()`, `reverse()`, and `qr()`. Use these methods exclusively.',
        'For sandbox testing, `createClient()` with no arguments works immediately — bundled credentials and certificates are included.',
        'For production, pass `env: \'production\'` plus your consumer key, secret, shortcode, passkey, initiator name, and initiator password.',
      ],
    },
    {
      category: 'Credentials',
      rules: [
        'Never hardcode consumer keys, consumer secrets, or passwords. Use environment variables: `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET`.',
        'OAuth tokens are managed automatically by the SDK — never generate, cache, or refresh tokens manually.',
        'SecurityCredentials for B2C are encrypted automatically using bundled Safaricom certificates. Never do RSA encryption manually.',
        'Get free sandbox credentials at https://developer.safaricom.co.ke. Register, create an app, and copy the consumer key and secret.',
      ],
    },
    {
      category: 'Callbacks',
      rules: [
        'STK Push (`collect()`) does NOT need a callback URL. The SDK auto-polls the STK Query endpoint for the result.',
        'B2C (`send()`), transaction status (`status()`), account balance (`balance()`), and reversal (`reverse()`) all REQUIRE a callback URL.',
        'QR code generation (`qr()`) does NOT need a callback URL.',
        'Callback URLs must use HTTPS. Never use HTTP or localhost URLs.',
        'For local development, use ngrok or cloudflared to create a public HTTPS URL pointing to your local server.',
      ],
    },
    {
      category: 'Error Handling',
      rules: [
        'Always wrap M-Pesa calls in try/catch blocks.',
        'Every `MpesaError` has a `.suggestion` field with actionable guidance. Surface this to users.',
        'Every `MpesaError` also has `.code`, `.darajaCode`, `.httpStatus`, and `.raw` fields for debugging.',
        'Specific error classes: `AuthError` (credential issues), `ValidationError` (bad input), `TimeoutError` (request timed out), `InsufficientFundsError` (not enough balance).',
        'Common STK Push error codes: 1032 (user cancelled — don\'t auto-retry), 1037 (phone unreachable — ask user to check phone), 1 (insufficient funds — prompt top-up).',
      ],
    },
    {
      category: 'Phone Numbers',
      rules: [
        'Accept any Kenyan phone format from users: 0712345678, +254712345678, or 254712345678. The SDK normalizes all formats to 254XXXXXXXXX.',
        'The sandbox test phone number is 254708374149. Use it in all sandbox examples.',
        "Never reject a phone number for format — pass it to the SDK and let it normalize.",
      ],
    },
    {
      category: 'Amounts and Limits',
      rules: [
        'Amounts must be whole numbers in KES. No decimals. Minimum 1 KES.',
        'STK Push maximum per transaction: KES 150,000.',
        '`AccountReference` (the `reference` parameter) has a maximum of 12 characters.',
        '`TransactionDesc` (the `description` parameter) has a maximum of 13 characters in the request. Longer values cause error 1025/9999.',
        'Duplicate transaction protection: wait at least 30 seconds before retrying the same phone + amount combination.',
      ],
    },
    {
      category: 'Code Generation',
      rules: [
        'Always generate complete, runnable code — not snippets. Include package.json with dependencies, server file, and any HTML/CSS needed.',
        'Include clear setup instructions: npm install, environment variables, npm start.',
        'Default to sandbox mode. Production is an explicit upgrade that requires go-live approval.',
        'Include error handling with try/catch in every example. Show how to use the `.suggestion` field.',
      ],
    },
  ],
  metadata: {
    platform: 'Safaricom Daraja',
    sdk: '@daraja-kit/sdk',
    documentation: 'https://developer.safaricom.co.ke',
    sandbox_test_phone: '254708374149',
  },
};

export const integration: Skill = {
  name: 'mpesa-integration',
  version: '1.0.0',
  description:
    'Step-by-step guide for building M-Pesa integrations with the Daraja 4.0 SDK. Covers integration flow, template selection, environment setup, sandbox testing, and production go-live.',
  instructions: [
    {
      category: 'Integration Flow',
      rules: [
        'Step 1: Install the SDK — `npm install @daraja-kit/sdk`.',
        'Step 2: Create a client — `const mpesa = createClient()` for sandbox (zero config) or with credentials for production.',
        "Step 3: Call the appropriate method — `collect()` for payments, `send()` for disbursements, `qr()` for QR codes.",
        "Step 4: Handle the result — check `result.status` and handle success/failure cases with user-friendly messages.",
        'Step 5: Test in sandbox — use phone 254708374149 for STK Push testing.',
        "Step 6: Go live — get credentials from Safaricom, pass `env: 'production'` to `createClient()`.",
      ],
    },
    {
      category: 'Template Selection',
      rules: [
        'For accepting donations or one-time payments: use the donation-page pattern — STK Push with a simple form.',
        'For e-commerce checkout: use the ecommerce-checkout pattern — product listing + M-Pesa payment at cart completion.',
        'For recurring payments or subscriptions: use the subscription-billing pattern — cron-based STK Push re-prompting.',
        'For paying employees or customers: use the b2c-disbursement pattern — batch B2C with callback handling.',
        'For walk-in or in-store payments: use QR code generation — customer scans to pay via M-Pesa app.',
      ],
    },
    {
      category: 'Environment Setup',
      rules: [
        'Sandbox: Zero config. `createClient()` with no arguments uses bundled sandbox credentials (shortcode 174379, test passkey, community consumer key/secret).',
        'Sandbox URL: https://sandbox.safaricom.co.ke (handled by SDK).',
        "Production URL: https://api.safaricom.co.ke (handled by SDK when `env: 'production'`).",
        'Production requires: your own consumer key/secret, shortcode, passkey, and (for B2C) initiator name/password + production certificate.',
        'Create a `.env` file with: DARAJA_CONSUMER_KEY, DARAJA_CONSUMER_SECRET, DARAJA_ENV (sandbox or production).',
        'The SDK reads environment variables automatically: DARAJA_ENV, DARAJA_CONSUMER_KEY, DARAJA_CONSUMER_SECRET, DARAJA_SHORTCODE, DARAJA_PASSKEY.',
      ],
    },
    {
      category: 'Sandbox Testing',
      rules: [
        'Test phone number: 254708374149. STK Push to this number will simulate a successful payment.',
        'Sandbox STK Push simulates the full flow: prompt → user enters PIN → result returned via polling.',
        'No real money is charged in sandbox. All transactions are simulated.',
        'Sandbox may occasionally be slow or return timeout errors. This is normal — retry after a few seconds.',
        'Test authentication separately first: if `createClient()` succeeds, your credentials are valid.',
        'For B2C testing, you need ngrok or cloudflared for callback URLs since Daraja sends results to your callback.',
      ],
    },
    {
      category: 'Going Live',
      rules: [
        'Go-live requires: (1) a Safaricom business shortcode or till number, (2) a go-live approval letter from Safaricom, (3) production API credentials.',
        "Steps: Apply for go-live on the Daraja portal → Submit business documents → Receive production credentials → Update code to use `env: 'production'`.",
        'Production checklist: remove all sandbox references, use production credentials via env vars, use HTTPS callback URLs, add retry/resilience logic, implement idempotency for payment status checks.',
        'Never deploy with sandbox credentials to production. The sandbox shortcode (174379) does not process real payments.',
        'Production has stricter rate limits and requires IP whitelisting for some APIs.',
      ],
    },
    {
      category: 'Server Architecture',
      rules: [
        'Express.js is the recommended server framework. All templates use Express.',
        'Create a POST endpoint for payment initiation (e.g., `POST /api/pay`).',
        "For APIs requiring callbacks, create a POST endpoint to receive Daraja's async results (e.g., `POST /api/callback`).",
        'Always validate and sanitize user input before passing to SDK methods.',
        'Use environment variables for all configuration — never hardcode values in server code.',
      ],
    },
  ],
  metadata: {
    platform: 'Safaricom Daraja',
    sdk: '@daraja-kit/sdk',
    documentation: 'https://developer.safaricom.co.ke',
    sandbox_shortcode: '174379',
    sandbox_test_phone: '254708374149',
  },
};

export const troubleshooting: Skill = {
  name: 'mpesa-troubleshooting',
  version: '1.0.0',
  description:
    'Troubleshooting guide for M-Pesa Daraja API errors. Covers error code decision trees, common failure patterns, callback debugging, OAuth issues, and production migration problems.',
  instructions: [
    {
      category: 'STK Push Errors',
      rules: [
        "Error 1032 (User Cancelled): The customer dismissed the STK prompt. Show 'Payment cancelled. Tap Pay to try again.' Do NOT auto-retry — the user intentionally cancelled.",
        'Error 1037 (Phone Unreachable): Phone is off, airplane mode, no signal, or iOS eSIM issue. Ask user to check their phone. For iOS, restarting often fixes eSIM issues. Retry after 10-30 seconds.',
        'Error 1001 (USSD Session Active): Customer has an active *334# or USSD session blocking STK. Ask them to cancel the USSD dialog and wait 2-3 minutes before retrying.',
        'Error 1025/9999 (STK Delivery Failed): Usually caused by `description` exceeding 13 characters. Shorten `description` parameter and retry.',
        "Error 1 (Insufficient Funds): Customer doesn't have enough M-Pesa balance. Prompt them to top up.",
        'Error 35 (Duplicate Transaction): Same phone + amount sent too quickly. Wait 30 seconds before retrying.',
        "Error 99 (No Transaction Found): STK Query can't find the transaction — the 60-second window expired. Re-initiate the STK Push.",
        "Status stays 'pending': The customer hasn't acted on the STK prompt. Ask them to check their phone for the M-Pesa prompt.",
      ],
    },
    {
      category: 'Authentication Errors',
      rules: [
        'HTTP 401 (Unauthorized): Invalid or expired OAuth token. The SDK auto-refreshes tokens — if you see this, your consumer key or secret is wrong. Verify them on the Daraja portal.',
        "HTTP 403 (Forbidden): App not subscribed to this API, or IP not whitelisted (production). Check your app's API subscriptions on the portal.",
        "HTTP 404 with 'Invalid Access Token': Daraja returns 404 (not 401) for some token errors. The SDK handles this automatically with retry. If persistent, regenerate credentials.",
        "Error 2001 (Invalid Initiator Credentials): Wrong initiator name or password for B2C/status/balance/reversal. Sandbox defaults: initiatorName='testapi', password='Safaricom999!*!'. Check your certificate is correct.",
        "'Invalid Consumer Key' or 'Invalid Consumer Secret': Your credentials are wrong. Go to developer.safaricom.co.ke, verify your app's keys, and update your .env file.",
      ],
    },
    {
      category: 'Callback Issues',
      rules: [
        'Callbacks never arrive: Check that your URL is publicly accessible (not localhost), uses HTTPS, and responds with HTTP 200. Use ngrok for local dev.',
        "Callback URL validation: Daraja validates callback URLs when you call B2C/status/balance/reversal. If the URL is unreachable, the API call may still succeed but you won't get results.",
        'Testing callbacks locally: Use `ngrok http 3000` to get a public HTTPS URL. Update your callback URL to use the ngrok URL.',
        "Remember: STK Push (collect) does NOT use callbacks. If you're debugging STK Push, the issue is not callback-related — check the polling result instead.",
        "Callback response format: Always respond with HTTP 200 to Daraja's callback POST request. If you return an error status, Daraja may retry the callback.",
      ],
    },
    {
      category: 'Environment Issues',
      rules: [
        "Wrong environment: If you get unexpected errors, verify you're using the right environment. Sandbox credentials don't work in production and vice versa.",
        'Sandbox flakiness: The Daraja sandbox occasionally returns timeout or 500 errors. This is normal sandbox behavior. Wait a few seconds and retry.',
        'Missing passkey: Each shortcode has its own passkey. Sandbox passkey is bundled in the SDK. Production passkey is provided by Safaricom with your go-live credentials.',
        'Certificate mismatch: Sandbox and production use different Safaricom certificates. The SDK bundles the sandbox certificate. For production, you need the production certificate from Safaricom.',
        'Base URL mismatch: Never hardcode Daraja URLs. Use `env: \'sandbox\'` or `env: \'production\'` and let the SDK handle URLs.',
      ],
    },
    {
      category: 'Common Mistakes',
      rules: [
        'Decimal amounts: Daraja rejects amounts with decimals. Round to the nearest integer. 100.50 → 101.',
        'AccountReference too long: Max 12 characters. Truncate if needed.',
        'TransactionDesc too long: Max 13 characters in the request. Longer values cause silent failures (error 1025/9999).',
        'Phone number format: The SDK accepts any Kenyan format and normalizes it. If you are manually formatting, use 254XXXXXXXXX (no + prefix, 12 digits).',
        'Retrying cancelled payments: Never auto-retry error 1032. The user chose to cancel. Always ask before retrying.',
        'Missing error handling: Not wrapping M-Pesa calls in try/catch. Always catch errors and check the `.suggestion` field for guidance.',
      ],
    },
    {
      category: 'Diagnostic Steps',
      rules: [
        'Step 1: Check the error code. Use the MCP `daraja_diagnose` tool or refer to the error codes documentation.',
        'Step 2: Check the `.suggestion` field on any MpesaError for immediate guidance.',
        'Step 3: Verify credentials — can you call `createClient()` and make a simple request?',
        'Step 4: Verify environment — are you in sandbox or production? Do your credentials match?',
        'Step 5: Check network — can you reach sandbox.safaricom.co.ke or api.safaricom.co.ke?',
        'Step 6: For callback-based APIs, verify your callback URL is publicly accessible and responds with 200.',
        'Step 7: If nothing works, check the Daraja portal for service status or contact Safaricom support.',
      ],
    },
  ],
  metadata: {
    platform: 'Safaricom Daraja',
    sdk: '@daraja-kit/sdk',
    support: 'https://developer.safaricom.co.ke',
    sandbox_test_phone: '254708374149',
  },
};

export const allSkills: Skill[] = [bestPractices, integration, troubleshooting];
