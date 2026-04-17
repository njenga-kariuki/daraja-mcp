import { searchKnowledge } from '../knowledge.js';

interface DiagnoseInput {
  error: string;
  context?: string;
  method?: 'collect' | 'send' | 'query' | 'balance' | 'reverse' | 'register_url' | 'c2b';
}

export interface DiagnoseTraceStep {
  step:
    | 'normalize_input'
    | 'extract_code'
    | 'error_db_hit'
    | 'method_refinement'
    | 'pattern_match'
    | 'disambiguation'
    | 'kb_search'
    | 'fallback';
  detail: string;
  source?: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface Hypothesis {
  cause: string;
  likelihood: 'most-likely' | 'possible' | 'uncommon';
  distinguishingSignal: string;
  fix: string;
  whenToSuspect: string;
}

export interface FollowUp {
  question: string;
  possibleAnswers: string[];
  nextInputHint: string;
}

interface DiagnoseOutput {
  errorCode: string;
  meaning: string;
  rootCause: string;
  fix: string;
  prevention?: string;
  codeExample?: string;
  relatedDocs: string[];
  trace: DiagnoseTraceStep[];
  confidence: 'high' | 'medium' | 'low';
  hypotheses?: Hypothesis[];
  followUp?: FollowUp;
  context?: Record<string, unknown>;
}

export const diagnoseSchema = {
  name: 'daraja_diagnose',
  description:
    'Diagnose a Daraja/M-Pesa API error. Provide an error code, message, full STK callback JSON, Daraja error response JSON, or log line — the tool auto-parses JSON payloads and extracts the ResultCode. Returns root cause, fix, prevention, a decision trace, and (when ambiguous) ranked hypotheses.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      error: {
        type: 'string',
        description:
          'The error message, code, STK callback JSON, Daraja error response JSON, or log line. The tool auto-parses JSON payloads and extracts the ResultCode.',
      },
      context: {
        type: 'string',
        description:
          'What API was being called and what you were trying to do. Helps disambiguate errors like 401/403 (OAuth vs callback vs SecurityCredential).',
      },
      method: {
        type: 'string',
        enum: ['collect', 'send', 'query', 'balance', 'reverse', 'register_url', 'c2b'],
        description:
          'The SDK method that produced the error. Refines advice for codes whose meaning changes by method (e.g. 1 on collect = customer balance, 1 on send = business float).',
      },
    },
    required: ['error'],
  },
};

/** Known Daraja error codes with structured diagnosis. */
const ERROR_DB: Record<string, Omit<DiagnoseOutput, 'relatedDocs' | 'trace' | 'confidence'>> = {
  '1': {
    errorCode: '1',
    meaning: 'Insufficient M-Pesa balance',
    rootCause: 'The customer does not have enough M-Pesa balance to complete the transaction.',
    fix: 'Inform the customer to top up their M-Pesa account and retry.',
    prevention: 'Show the payment amount clearly before initiating STK Push so customers can verify they have sufficient balance. Consider adding a "top up" link in your payment UI.',
  },
  '03': {
    errorCode: '03',
    meaning: 'Amount below minimum',
    rootCause: 'The amount is less than the minimum allowed (KES 1 for most APIs).',
    fix: 'Increase the amount to at least KES 1.',
    prevention: 'Add input validation before calling collect(): if (amount < 1) throw new Error("Minimum amount is KES 1"). The SDK accepts whole numbers only.',
    codeExample: `const amount = Math.max(1, Math.round(Number(userInput)));
await mpesa.collect({ amount, phone });`,
  },
  '04': {
    errorCode: '04',
    meaning: 'Amount above maximum',
    rootCause: 'The amount exceeds the per-transaction limit (KES 150,000 for STK Push).',
    fix: 'Reduce the amount or split into multiple transactions.',
    prevention: 'Add input validation: if (amount > 150000) prompt the user to split the payment. Display the limit in your UI.',
    codeExample: `const MAX_STK = 150_000;
if (amount > MAX_STK) {
  return res.status(400).json({ error: 'Maximum per-transaction amount is KES 150,000' });
}`,
  },
  '05': {
    errorCode: '05',
    meaning: 'Transaction timeout',
    rootCause: 'The transaction took too long to process on Daraja\'s side. This is a transient issue.',
    fix: 'Retry the transaction after a few seconds. If persistent, wait a few minutes — Daraja may be under load.',
    prevention: 'Implement exponential backoff for transient errors (05, 11, 29). See knowledge/patterns/resilience.md for a reusable retry pattern.',
  },
  '06': {
    errorCode: '06',
    meaning: 'Confirmation failed',
    rootCause: 'M-Pesa could not confirm the transaction downstream. Usually a transient issue, but persistent 06 often signals a provisioning problem on the receiving shortcode.',
    fix: 'Retry once after a short delay. If the retry also fails with 06, the receiving shortcode may not be correctly provisioned — escalate to your Safaricom account manager or email apisupport@safaricom.co.ke with your shortcode and a sample CheckoutRequestID.',
    prevention: 'Treat 06 as a transient error in your first retry pass. Page your ops team on repeated 06 from the same shortcode — it usually indicates a Safaricom-side provisioning issue, not a code bug.',
  },
  '08': {
    errorCode: '08',
    meaning: 'Daily transaction limit exceeded',
    rootCause: 'The customer has exceeded their daily M-Pesa transaction limit.',
    fix: 'The customer must wait until the next day or use a different payment method.',
    prevention: 'This is not a code bug — it is a customer-side limit. Show a helpful message: "Daily M-Pesa limit reached. Try again tomorrow or use a different payment method."',
  },
  '10': {
    errorCode: '10',
    meaning: 'Not registered on M-Pesa',
    rootCause: 'The phone number is not registered for M-Pesa services.',
    fix: 'The customer must register for M-Pesa at a Safaricom agent first.',
    prevention: 'This is not a code bug. Show a user-friendly message: "This number is not registered on M-Pesa. Please register at any Safaricom agent." Avoid exposing raw error codes.',
  },
  '11': {
    errorCode: '11',
    meaning: 'System error',
    rootCause: 'Internal Daraja system error. This is transient.',
    fix: 'Retry after a short delay. If persistent, contact Safaricom support.',
    prevention: 'Implement exponential backoff for transient errors. Do not retry immediately — wait 2-5 seconds, then 10 seconds, then 30 seconds. See knowledge/patterns/resilience.md.',
  },
  '12': {
    errorCode: '12',
    meaning: 'Transaction details mismatch',
    rootCause: 'Transaction details do not match — e.g., wrong shortcode/passkey combination.',
    fix: 'Verify your shortcode, passkey, and other parameters are correct for your environment (sandbox vs production).',
    prevention: 'Store shortcode and passkey in environment variables, not hardcoded. Use separate .env files for sandbox and production to avoid mixing them.',
  },
  '29': {
    errorCode: '29',
    meaning: 'System downtime',
    rootCause: 'Daraja is undergoing maintenance or experiencing an outage.',
    fix: 'Wait a few minutes and retry. Do not retry aggressively — you will hit rate limits.',
    prevention: 'Implement a circuit breaker: if 3+ consecutive requests fail with 29, pause all requests for 60 seconds. See knowledge/patterns/resilience.md.',
  },
  '32': {
    errorCode: '32',
    meaning: 'Service not activated on shortcode',
    rootCause: 'Your paybill or till does not have STK Push (or the specific API) enabled at the Safaricom side. The credentials are valid but the service is off.',
    fix: 'Email apisupport@safaricom.co.ke requesting activation of the specific service (STK Push, C2B, B2C, etc.) for your shortcode. Include your shortcode, app name, and a copy of your go-live approval.',
    prevention: 'Verify every API you intend to use is enabled on your shortcode before go-live. Use daraja_preflight to catch missing enablement early. Keep a signed copy of the Safaricom enablement confirmation with your credentials.',
  },
  '33': {
    errorCode: '33',
    meaning: 'Go-live not approved',
    rootCause: 'You are calling production APIs before Safaricom has approved your go-live. The sandbox integration works but production is still gated on human review.',
    fix: 'Complete the go-live checklist (use the daraja_go_live tool) and submit the application. Approval typically takes 3-7 business days. Until approval lands, keep your environment flag on sandbox.',
    prevention: 'Keep `environment: "sandbox"` in your production config until the approval email arrives, then flip the flag. Do not split-deploy with half-approved credentials.',
  },
  '34': {
    errorCode: '34',
    meaning: 'Processing delay (do NOT retry)',
    rootCause: 'Daraja is slow but the transaction did not fail. Retrying creates a duplicate (error 35 on the retry and real money movement on both paths).',
    fix: 'Do NOT retry. Wait 60 seconds and query the transaction status with mpesa.status({ transactionId }) or rely on the callback. The SDK auto-polling handles this correctly.',
    prevention: 'Exclude code 34 from your retry logic. A retry-on-34 policy is the #1 cause of double-charges in custom Daraja integrations. Let the callback resolve the transaction state.',
    codeExample: `// In your retry logic:
if (err.darajaCode === '34') {
  // Do not retry. Wait for the callback or query status.
  return awaitStatus(err.transactionId);
}`,
  },
  '35': {
    errorCode: '35',
    meaning: 'Duplicate transaction',
    rootCause: 'A transaction with the same parameters (phone + amount) was just processed. Daraja enforces a ~30-second cooldown.',
    fix: 'Wait at least 30 seconds before retrying the same phone + amount combination.',
    prevention: 'Add a 30-second cooldown between requests for the same phone + amount. Store the last request timestamp and skip if too recent. This also prevents accidental double-charges from retry logic.',
    codeExample: `// Simple deduplication
const recentRequests = new Map();
function isDuplicate(phone, amount) {
  const key = \`\${phone}:\${amount}\`;
  const last = recentRequests.get(key);
  if (last && Date.now() - last < 30_000) return true;
  recentRequests.set(key, Date.now());
  return false;
}`,
  },
  '36': {
    errorCode: '36',
    meaning: 'Incorrect credentials',
    rootCause: 'Wrong passkey or shortcode — the credentials do not match the target environment.',
    fix: 'Verify your passkey and shortcode match your environment. For sandbox, use the sandbox passkey with shortcode 174379.',
    prevention: 'Use environment variables for all credentials. The SDK auto-loads sandbox defaults with createClient() — only override when you have production credentials.',
  },
  '41': {
    errorCode: '41',
    meaning: 'Invalid MSISDN (phone number)',
    rootCause: 'The phone number format is invalid. Daraja requires 254XXXXXXXXX format.',
    fix: 'Use format 254XXXXXXXXX (12 digits, starting with 254). The SDK normalizes automatically.',
    prevention: 'If using the SDK, phone normalization is automatic. If calling Daraja directly, always normalize first: phone.replace(/^0/, "254").replace(/^\\+/, "").',
  },
  '42': {
    errorCode: '42',
    meaning: 'Passkey/paybill mismatch',
    rootCause: 'The passkey does not correspond to the shortcode being used.',
    fix: 'Ensure the passkey matches your shortcode. For sandbox, use the sandbox passkey with shortcode 174379.',
    prevention: 'Never mix sandbox and production credentials. Use separate environment files (.env.sandbox, .env.production) and the SDK\'s environment config.',
  },
  '43': {
    errorCode: '43',
    meaning: 'Duplicate MerchantRequestID',
    rootCause: 'Your code sent the same MerchantRequestID twice. Daraja rejects this because MerchantRequestID must be unique per transaction — it is your idempotency key.',
    fix: 'Generate a unique MerchantRequestID per request. The SDK does this automatically via crypto.randomUUID(). If calling Daraja directly, use crypto.randomUUID() or a similar source of uniqueness.',
    prevention: 'Never derive MerchantRequestID from deterministic data (user ID, timestamp, order number). Always use crypto.randomUUID() per request. Retries must generate a new ID — the same ID across retries is exactly what 43 flags.',
    codeExample: `import { randomUUID } from 'node:crypto';
const merchantRequestId = randomUUID(); // one per request`,
  },
  '99': {
    errorCode: '99',
    meaning: 'No transaction found',
    rootCause: 'STK Query could not find the transaction. The STK prompt was likely not completed within 60 seconds, or the CheckoutRequestID is invalid.',
    fix: 'The payment timed out. The SDK handles polling automatically — if you see this, the customer did not complete the prompt in time.',
    prevention: 'Increase pollTimeout if customers need more time: mpesa.collect({ ..., pollTimeout: 90000 }). Show a clear countdown in your UI so customers know to act quickly.',
  },
  '1001': {
    errorCode: '1001',
    meaning: 'USSD session in progress',
    rootCause:
      'The customer has an active USSD session (e.g., checking balance, another STK prompt) that blocks the new STK Push.',
    fix: 'Wait 2-3 minutes for the existing session to expire, then retry. Show a "please wait" message to the user.',
    prevention: 'Show users a message: "Please close any M-Pesa dialogs on your phone before continuing." Add an auto-retry with a 3-minute delay.',
  },
  '1025': {
    errorCode: '1025',
    meaning: 'STK Push delivery failed',
    rootCause:
      'The STK prompt could not be delivered. Most common cause: TransactionDesc exceeds 182 characters (including whitespace).',
    fix: 'Shorten your TransactionDesc to under 182 characters. If using the SDK, this is handled automatically. Also check AccountReference is under 12 characters.',
    prevention: 'Add input validation: if (description.length > 13) truncate or reject. Keep AccountReference under 12 chars. The SDK validates automatically.',
    codeExample:
      "await mpesa.collect({ amount: 100, phone: '0712345678', description: 'Payment' }); // max 13 chars",
  },
  '1032': {
    errorCode: '1032',
    meaning: 'Request cancelled by user',
    rootCause:
      'The customer either: (1) pressed Cancel on the STK prompt, (2) entered wrong PIN, or (3) the prompt timed out without response.',
    fix: 'This is expected user behavior. Show a "Payment cancelled" message and offer a retry button. If recurring, check if the user is experiencing the prompt at all.',
    prevention: 'Do not auto-retry cancelled payments — the customer chose to cancel. Show a clear retry button instead. Track cancel rates — high rates may indicate UX confusion.',
    codeExample: `const result = await mpesa.collect({ amount: 100, phone: '0712345678' });
if (result.status === 'cancelled') {
  console.log('User cancelled — show retry option');
}`,
  },
  '1037': {
    errorCode: '1037',
    meaning: 'Phone unreachable (MSISDN not reachable)',
    rootCause:
      "The customer's phone is off, out of network, or has SIM issues. This is especially common with iOS eSIM users.",
    fix: 'Ask the customer to: (1) check their phone is on and has signal, (2) restart their phone if using eSIM, (3) try again. For iOS eSIM issues, the user may need to contact Safaricom.',
    prevention: 'Show users a "check your phone" message with a retry button. Consider offering QR payment (mpesa.qr()) as a fallback for customers with connectivity issues.',
  },
  '2001': {
    errorCode: '2001',
    meaning: 'Invalid initiator credentials',
    rootCause:
      'The initiator name or password is wrong. For B2C: check initiatorName and initiatorPassword. For STK Push: this means wrong M-Pesa PIN (customer-side).',
    fix: 'For B2C: verify MPESA_INITIATOR_NAME and MPESA_INITIATOR_PASSWORD match your Daraja app credentials. For sandbox, use "testapi" / "Safaricom999!*!".',
    prevention: 'Use the SDK sandbox defaults for development (createClient() auto-loads them). For production, store initiator credentials in environment variables and test with daraja_test_sandbox before deploying.',
  },
  '9999': {
    errorCode: '9999',
    meaning: 'STK Push delivery failed (system error)',
    rootCause: 'Similar to 1025 — the STK prompt failed to deliver. Can also indicate a Daraja system issue.',
    fix: 'Check TransactionDesc length (max 182 chars), verify phone number format, and retry. If persistent, Daraja may be experiencing downtime.',
    prevention: 'Keep description and reference short. Implement a single retry for 9999 errors — if the retry also fails, it is likely a Daraja-side issue.',
  },
  '500.001.1001': {
    errorCode: '500.001.1001',
    meaning: 'Invalid initiator information (B2C-specific 500)',
    rootCause:
      'The SecurityCredential you sent decrypts to the wrong password on the Safaricom side. Common cause: using the sandbox certificate with production credentials (or vice versa), or a stale/cached credential.',
    fix: 'Verify you are using the environment-matching certificate. The SDK auto-selects the correct cert based on environment. If calling Daraja directly, sandbox uses `SandboxCertificate.cer` and production uses `ProductionCertificate.cer` — never mix.',
    prevention: 'Let the SDK handle certificate selection via `createClient({ environment })`. Never hand-bake SecurityCredential generation in your code. Rotate production credentials via the portal, not manually.',
    codeExample: `// Let the SDK pick the right cert per environment
const mpesa = createClient({ environment: 'production' });
await mpesa.send({ amount: 1000, phone, callbackUrl });`,
  },
  '404.001.04': {
    errorCode: '404.001.04',
    meaning: 'Resource not found (namespaced)',
    rootCause:
      'The endpoint URL or request body is wrong. Most common cause: mixing sandbox and production base URLs — e.g., calling https://api.safaricom.co.ke with sandbox credentials.',
    fix: 'Verify the endpoint URL matches your environment. Use the SDK (`createClient({ environment })`) which picks the correct base URL automatically. Never hardcode Daraja URLs.',
    prevention: 'Use `createClient({ environment })` and let the SDK pick the base URL. If you must call raw HTTP, centralize URL selection in one config module and read `process.env.NODE_ENV` to switch.',
  },
};

/**
 * Method-specific refinements for codes whose meaning changes by SDK method.
 * Sparse — only entries where the advice is materially different.
 */
const METHOD_OVERRIDES: Record<
  string,
  Partial<Omit<DiagnoseOutput, 'relatedDocs' | 'trace' | 'confidence'>>
> = {
  '1:send': {
    rootCause:
      'Your business shortcode has insufficient M-Pesa float to send B2C. This is your side, not the customer side.',
    fix: 'Top up your business M-Pesa float via the Safaricom portal or contact your account manager. Then retry the B2C.',
    prevention:
      'Monitor your business float balance via mpesa.balance(). Set up alerts when float drops below a threshold. Top up proactively before scheduled payroll runs.',
  },
  '12:send': {
    rootCause:
      'For B2C, error 12 means the initiator name/password does not match the shortcode — different from STK Push where it means passkey/shortcode mismatch.',
    fix: 'Verify MPESA_INITIATOR_NAME and MPESA_INITIATOR_PASSWORD match your B2C shortcode. For sandbox, use initiator "testapi" + password "Safaricom999!*!" with B2C shortcode 600999.',
    prevention:
      'Store initiator credentials per-environment in separate env files. Test with daraja_test_sandbox before deploying B2C logic.',
  },
  '2001:collect': {
    rootCause:
      'For STK Push (collect), 2001 means the customer entered their M-Pesa PIN incorrectly too many times. Customer-side, not a code bug.',
    fix: 'Not a code bug — show a clear retry message to the customer. They need to wait a few minutes and enter the correct PIN.',
    prevention:
      'Display a friendly "payment failed — please try again with correct PIN" message. Do not auto-retry; customer intent matters.',
  },
  '1025:query': {
    rootCause:
      '1025 on stkPushQuery means the query itself failed — not the original payment. Common cause: the CheckoutRequestID has expired (>60s) or is malformed.',
    fix: 'Query within 60 seconds of initiating the payment. The SDK\'s auto-polling handles this. If polling manually, do not retry after 60s — the payment outcome is final.',
    prevention:
      'Let the SDK\'s polling handle status queries. If you must query manually, gate on a 60-second window from the original request timestamp.',
  },
};

/**
 * Ranked hypotheses for pattern-matched errors (401/403, callback, security).
 * Used to explain *why* a given suggestion was chosen and offer alternatives.
 */
const PATTERN_HYPOTHESES: Record<string, Hypothesis[]> = {
  auth: [
    {
      cause: 'OAuth token request failed (wrong consumer key/secret)',
      likelihood: 'most-likely',
      distinguishingSignal: 'The 401 comes from the very first API call in the process, and the URL path contains /oauth/v1/generate.',
      fix: 'Verify DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET. Get them from developer.safaricom.co.ke → My Apps. Check no trailing whitespace.',
      whenToSuspect: 'You see this on cold starts or right after rotating credentials.',
    },
    {
      cause: 'Callback endpoint is itself returning 401 to Daraja',
      likelihood: 'possible',
      distinguishingSignal: 'Your server logs show the 401 on your /callback route, not on an outbound Daraja call. Daraja\'s delivery log will indicate 401 from your URL.',
      fix: 'Your callback endpoint must accept unauthenticated POST requests from Safaricom IPs. Remove any auth middleware from the callback route.',
      whenToSuspect: 'Payments succeed on the phone but your app never hears back; Daraja retry logs show 401 from your URL.',
    },
    {
      cause: 'SecurityCredential rejected (B2C/balance/reversal)',
      likelihood: 'possible',
      distinguishingSignal: 'The 401 happens specifically on B2C, Status, Balance, or Reversal calls — not on collect().',
      fix: 'Regenerate SecurityCredential from the correct environment cert. Verify initiator name and password. Sandbox uses "testapi" / "Safaricom999!*!".',
      whenToSuspect: 'collect() works fine but send()/balance()/reverse() all 401.',
    },
  ],
  callback: [
    {
      cause: 'Callback URL is not publicly reachable',
      likelihood: 'most-likely',
      distinguishingSignal: 'Your URL is localhost, a private IP, or behind a firewall. curl from outside your network cannot reach it.',
      fix: 'Use ngrok (`npx ngrok http 3000`) for local dev. For production: ensure the server has a public DNS name and a valid TLS certificate.',
      whenToSuspect: 'Works on your laptop but never in production-like tests.',
    },
    {
      cause: 'Callback URL uses plain HTTP, not HTTPS',
      likelihood: 'possible',
      distinguishingSignal: 'Your URL starts with http:// not https://.',
      fix: 'Daraja requires HTTPS for callbacks. Use ngrok (HTTPS by default) or put your server behind a CDN/load balancer that terminates TLS.',
      whenToSuspect: 'Sandbox is configured, URL is public, but Daraja never actually posts to it.',
    },
    {
      cause: 'Callback handler does not return a valid acknowledgement',
      likelihood: 'possible',
      distinguishingSignal: 'Daraja receives something from your server but considers the callback failed because you did not return the expected `{ResultCode: 0, ResultDesc: "Accepted"}` shape.',
      fix: 'Respond with `res.json({ ResultCode: 0, ResultDesc: "Accepted" })` to every callback POST, inside a try/catch so an exception does not leave Daraja hanging.',
      whenToSuspect: 'Your logs show the callback arrived but Daraja keeps retrying.',
    },
  ],
  security_credential: [
    {
      cause: 'Using the wrong environment certificate',
      likelihood: 'most-likely',
      distinguishingSignal: 'Your code works in sandbox but fails in production (or vice versa).',
      fix: 'Let the SDK pick the cert via `createClient({ environment })`. Sandbox uses SandboxCertificate.cer, production uses ProductionCertificate.cer. Never mix.',
      whenToSuspect: 'The integration flipped envs recently or a certificate file was swapped.',
    },
    {
      cause: 'Initiator password is wrong for the environment',
      likelihood: 'possible',
      distinguishingSignal: 'Sandbox expects "Safaricom999!*!" exactly. Production uses the password you set during go-live.',
      fix: 'Sandbox: `MPESA_INITIATOR_PASSWORD=Safaricom999!*!`. Production: the password you configured during go-live (not your M-Pesa PIN).',
      whenToSuspect: 'The password field in your .env was copy-pasted between envs or came from another project.',
    },
    {
      cause: 'Certificate file is corrupted or truncated',
      likelihood: 'uncommon',
      distinguishingSignal: 'The .cer file size is unusually small (<500 bytes) or not a valid PEM-ish format.',
      fix: 'Re-download the certificate from the Daraja portal (Production) or use the bundled sandbox cert the SDK ships with.',
      whenToSuspect: 'A recent deploy introduced the cert file and nothing else changed.',
    },
  ],
};

interface NormalizedInput {
  code?: string;
  kind: 'callback' | 'error_response' | 'log_line' | 'free_text';
  extracted: Record<string, unknown>;
}

/**
 * Parse rich inputs — STK callback JSON, Daraja error-response JSON, log lines —
 * and extract the ResultCode plus useful metadata.
 */
function normalizeInput(raw: string): NormalizedInput {
  const s = raw.trim();

  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      const obj = JSON.parse(s) as Record<string, unknown>;
      const body = obj.Body as Record<string, unknown> | undefined;
      const stkCallback = body?.stkCallback as Record<string, unknown> | undefined;
      const result = obj.Result as Record<string, unknown> | undefined;
      const cb = stkCallback ?? result;
      if (cb) {
        const code = cb.ResultCode != null ? String(cb.ResultCode) : '';
        return {
          code,
          kind: 'callback',
          extracted: {
            resultDesc: cb.ResultDesc,
            merchantRequestID: cb.MerchantRequestID,
            checkoutRequestID: cb.CheckoutRequestID,
          },
        };
      }

      if (obj.ResultCode != null) {
        return {
          code: String(obj.ResultCode),
          kind: 'error_response',
          extracted: { resultDesc: obj.ResultDesc },
        };
      }

      if (obj.errorCode != null || obj.error_description != null) {
        return {
          code: obj.errorCode != null ? String(obj.errorCode) : '',
          kind: 'error_response',
          extracted: {
            message: obj.errorMessage ?? obj.error_description,
            requestId: obj.requestId,
          },
        };
      }
    } catch {
      // fall through to log-line and free-text detection
    }
  }

  const logMatch = s.match(/ResultCode[\s:=]+['"]*(\d{1,4}|\d{3}\.\d{3}\.\d{1,4})/i);
  if (logMatch) {
    return {
      code: logMatch[1],
      kind: 'log_line',
      extracted: { line: s.slice(0, 200) },
    };
  }

  return { kind: 'free_text', extracted: {} };
}

function rankHypotheses(
  hypotheses: Hypothesis[],
  context?: string,
  method?: string,
): Hypothesis[] {
  if (!context && !method) return hypotheses;
  const ctx = (context ?? '').toLowerCase();
  const scored = hypotheses.map((h) => {
    let score = h.likelihood === 'most-likely' ? 3 : h.likelihood === 'possible' ? 2 : 1;
    const sig = h.distinguishingSignal.toLowerCase();
    if (ctx.includes('callback') && sig.includes('callback')) score += 3;
    if (ctx.includes('webhook') && sig.includes('callback')) score += 3;
    if ((ctx.includes('oauth') || ctx.includes('token') || ctx.includes('/oauth/')) && sig.includes('oauth')) score += 3;
    if ((ctx.includes('b2c') || method === 'send') && sig.toLowerCase().includes('b2c')) score += 3;
    if ((ctx.includes('b2c') || method === 'send') && h.cause.toLowerCase().includes('securitycredential')) score += 2;
    return { h, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.h);
}

export function handleDiagnose(input: DiagnoseInput): DiagnoseOutput {
  const trace: DiagnoseTraceStep[] = [];

  // Step 1: normalize rich input.
  const normalized = normalizeInput(input.error);
  trace.push({
    step: 'normalize_input',
    detail: `parsed as ${normalized.kind}${normalized.code ? `, extracted code=${normalized.code}` : ''}`,
    confidence: normalized.code ? 'high' : 'low',
  });

  // Step 2: extract code — prefer normalized, fall back to regex (supports dotted codes).
  let code = normalized.code ?? '';
  if (!code) {
    const codeMatch = input.error.match(/\b(\d{3}\.\d{3}\.\d{1,4}|\d{1,4})\b/);
    code = codeMatch?.[1] ?? '';
  }
  trace.push({
    step: 'extract_code',
    detail: code ? `matched "${code}"` : 'no numeric code found',
    confidence: code ? 'medium' : 'low',
  });

  const extractedContext = normalized.extracted;
  const hasExtracted = Object.keys(extractedContext).length > 0;

  // Step 3: ERROR_DB lookup (with optional method refinement).
  if (ERROR_DB[code]) {
    const known = ERROR_DB[code];
    trace.push({
      step: 'error_db_hit',
      detail: `${code} → ${known.meaning}`,
      source: `ERROR_DB['${code}']`,
      confidence: 'high',
    });

    let merged: Omit<DiagnoseOutput, 'relatedDocs' | 'trace' | 'confidence'> = { ...known };
    if (input.method) {
      const overrideKey = `${code}:${input.method}`;
      const override = METHOD_OVERRIDES[overrideKey];
      if (override) {
        merged = { ...merged, ...override };
        trace.push({
          step: 'method_refinement',
          detail: `applied ${input.method}-specific override`,
          source: `METHOD_OVERRIDES['${overrideKey}']`,
          confidence: 'high',
        });
      }
    }

    const relatedDocs = searchKnowledge(code + ' ' + known.meaning)
      .slice(0, 3)
      .map((r) => `${r.category}/${r.filename}`);
    trace.push({ step: 'kb_search', detail: `${relatedDocs.length} related doc(s)`, confidence: 'high' });

    return {
      ...merged,
      relatedDocs,
      trace,
      confidence: 'high',
      ...(hasExtracted ? { context: extractedContext } : {}),
    };
  }

  // Step 4: knowledge base search for context-aware related docs.
  const results = searchKnowledge(input.error + ' ' + (input.context ?? ''));
  const relatedDocs = results.slice(0, 3).map((r) => `${r.category}/${r.filename}`);

  // Step 5: sandbox-vs-prod divergence hint.
  const lowerContext = (input.context ?? '').toLowerCase();
  if (
    (lowerContext.includes('works in sandbox') || lowerContext.includes('production only') || lowerContext.includes('prod only')) &&
    !code
  ) {
    trace.push({
      step: 'pattern_match',
      detail: 'sandbox-vs-prod divergence signal in context',
      confidence: 'medium',
    });
    return {
      errorCode: 'SANDBOX_VS_PROD',
      meaning: 'Sandbox-vs-production divergence',
      rootCause:
        'Code behaves differently between sandbox and production. Common causes: different credentials, different certificate, provisioning gaps (e.g. STK not enabled on prod shortcode), rate limit differences, or SecurityCredential cert mismatch.',
      fix:
        'Run daraja_preflight against the production environment to surface missing enablement. Re-verify credentials are env-specific. Check that your cert file matches the environment.',
      prevention:
        'Never share env-specific values (passkeys, certs, initiator passwords) across sandbox and prod. Use daraja_preflight on both envs as part of every release.',
      relatedDocs,
      trace,
      confidence: 'medium',
      ...(hasExtracted ? { context: extractedContext } : {}),
    };
  }

  // Step 6: pattern matches — auth, callback, security. Enrich with hypotheses.
  if (
    input.error.includes('401') ||
    input.error.includes('403') ||
    input.error.toLowerCase().includes('auth')
  ) {
    trace.push({ step: 'pattern_match', detail: 'matched auth pattern (401/403/auth)', confidence: 'medium' });
    const hypotheses = rankHypotheses(PATTERN_HYPOTHESES.auth, input.context, input.method);
    return {
      errorCode: '401/403',
      meaning: 'Authentication failed',
      rootCause:
        'Invalid consumer key or consumer secret. Or the OAuth token has expired and auto-refresh failed. Could also be callback-endpoint auth or SecurityCredential — see hypotheses.',
      fix: 'Verify DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET. Get them from developer.safaricom.co.ke → My Apps.',
      relatedDocs,
      trace,
      confidence: 'medium',
      hypotheses,
      ...(hasExtracted ? { context: extractedContext } : {}),
    };
  }

  if (
    input.error.toLowerCase().includes('callback') ||
    input.error.toLowerCase().includes('timeout')
  ) {
    trace.push({ step: 'pattern_match', detail: 'matched callback/timeout pattern', confidence: 'medium' });
    const hypotheses = rankHypotheses(PATTERN_HYPOTHESES.callback, input.context, input.method);
    return {
      errorCode: 'CALLBACK',
      meaning: 'Callback URL not reachable',
      rootCause:
        'Daraja could not reach your callback URL. Common causes: URL is localhost (not public), no HTTPS, firewall blocking, or the handler does not ack with {ResultCode: 0}.',
      fix: 'For local dev: run "npx ngrok http 3000" and use the https URL. For production: ensure your server has a valid SSL certificate and is publicly accessible.',
      relatedDocs,
      trace,
      confidence: 'medium',
      hypotheses,
      ...(hasExtracted ? { context: extractedContext } : {}),
    };
  }

  if (
    input.error.toLowerCase().includes('security') ||
    input.error.toLowerCase().includes('credential')
  ) {
    trace.push({
      step: 'pattern_match',
      detail: 'matched SecurityCredential pattern',
      confidence: 'medium',
    });
    const hypotheses = rankHypotheses(
      PATTERN_HYPOTHESES.security_credential,
      input.context,
      input.method,
    );
    return {
      errorCode: 'SECURITY_CREDENTIAL',
      meaning: 'SecurityCredential error',
      rootCause:
        'The SecurityCredential (RSA-encrypted initiator password) is invalid. Causes: wrong certificate (sandbox vs production), wrong initiator password, corrupted cert file.',
      fix: 'The SDK generates SecurityCredential automatically. Verify: (1) certPath points to correct .cer file, (2) initiatorPassword is correct (sandbox: "Safaricom999!*!"), (3) you are using the sandbox cert for sandbox and production cert for production.',
      relatedDocs,
      trace,
      confidence: 'medium',
      hypotheses,
      ...(hasExtracted ? { context: extractedContext } : {}),
    };
  }

  // Step 7: fallback — offer a follow-up hint so the agent can ask for more info.
  trace.push({
    step: 'fallback',
    detail: 'no ERROR_DB or pattern match; returning UNKNOWN with followUp',
    confidence: 'low',
  });

  const followUp: FollowUp = !code
    ? {
        question: 'Do you have a Daraja error code or ResultCode from the response?',
        possibleAnswers: ["yes — I'll share it", 'only HTTP status', 'no response at all'],
        nextInputHint:
          'paste the full response body (JSON preferred) or the HTTP status line, and include context about which SDK method failed',
      }
    : {
        question: 'Which SDK method produced this error?',
        possibleAnswers: ['collect()', 'send()', 'query()', 'balance()', 'reverse()', 'c2b()'],
        nextInputHint:
          'pass the method name as the `method` input field on the next daraja_diagnose call',
      };

  return {
    errorCode: code || 'UNKNOWN',
    meaning: 'Unrecognized error',
    rootCause: `Could not automatically diagnose: "${input.error}". ${input.context ? `Context: ${input.context}` : ''}`,
    fix: 'Check the error-codes reference in knowledge/errors/error-codes.md or the top-20 index at knowledge/errors/top-20-index.md. If the error is from Daraja, include the full response body for better diagnosis.',
    relatedDocs,
    trace,
    confidence: 'low',
    followUp,
  };
}
