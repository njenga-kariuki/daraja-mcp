import { searchKnowledge } from '../knowledge.js';

interface DiagnoseInput {
  error: string;
  context?: string;
}

interface DiagnoseOutput {
  errorCode: string;
  meaning: string;
  rootCause: string;
  fix: string;
  prevention?: string;
  codeExample?: string;
  relatedDocs: string[];
}

export const diagnoseSchema = {
  name: 'daraja_diagnose',
  description:
    'Diagnose a Daraja/M-Pesa API error. Provide the error code, message, or full response and ' +
    'get the root cause, explanation, and fix.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      error: {
        type: 'string',
        description: 'The error message, code, or full JSON response from Daraja.',
      },
      context: {
        type: 'string',
        description: 'What API was being called and what you were trying to do.',
      },
    },
    required: ['error'],
  },
};

/** Known Daraja error codes with structured diagnosis. */
const ERROR_DB: Record<string, Omit<DiagnoseOutput, 'relatedDocs'>> = {
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
};

export function handleDiagnose(input: DiagnoseInput): DiagnoseOutput {
  // Extract error code from input.
  const codeMatch = input.error.match(/\b(\d{1,4})\b/);
  const code = codeMatch?.[1] ?? '';

  // Check known errors first.
  if (ERROR_DB[code]) {
    const known = ERROR_DB[code];
    const relatedDocs = searchKnowledge(code + ' ' + known.meaning)
      .slice(0, 3)
      .map((r) => `${r.category}/${r.filename}`);
    return { ...known, relatedDocs };
  }

  // Search knowledge base for context.
  const results = searchKnowledge(input.error + ' ' + (input.context ?? ''));
  const relatedDocs = results.slice(0, 3).map((r) => `${r.category}/${r.filename}`);

  // HTTP status code patterns.
  if (input.error.includes('401') || input.error.includes('403') || input.error.toLowerCase().includes('auth')) {
    return {
      errorCode: '401/403',
      meaning: 'Authentication failed',
      rootCause: 'Invalid consumer key or consumer secret. Or the OAuth token has expired and auto-refresh failed.',
      fix: 'Verify DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET. Get them from developer.safaricom.co.ke → My Apps.',
      relatedDocs,
    };
  }

  if (input.error.toLowerCase().includes('callback') || input.error.toLowerCase().includes('timeout')) {
    return {
      errorCode: 'CALLBACK',
      meaning: 'Callback URL not reachable',
      rootCause:
        'Daraja could not reach your callback URL. Common causes: URL is localhost (not public), no HTTPS, firewall blocking.',
      fix: 'For local dev: run "npx ngrok http 3000" and use the https URL. For production: ensure your server has a valid SSL certificate and is publicly accessible.',
      relatedDocs,
    };
  }

  if (input.error.toLowerCase().includes('security') || input.error.toLowerCase().includes('credential')) {
    return {
      errorCode: 'SECURITY_CREDENTIAL',
      meaning: 'SecurityCredential error',
      rootCause:
        'The SecurityCredential (RSA-encrypted initiator password) is invalid. Causes: wrong certificate (sandbox vs production), wrong initiator password, corrupted cert file.',
      fix: 'The SDK generates SecurityCredential automatically. Verify: (1) certPath points to correct .cer file, (2) initiatorPassword is correct (sandbox: "Safaricom999!*!"), (3) you are using the sandbox cert for sandbox and production cert for production.',
      relatedDocs,
    };
  }

  return {
    errorCode: code || 'UNKNOWN',
    meaning: 'Unrecognized error',
    rootCause: `Could not automatically diagnose: "${input.error}". ${input.context ? `Context: ${input.context}` : ''}`,
    fix: 'Check the error-codes reference in knowledge/errors/error-codes.md. If the error is from Daraja, include the full response body for better diagnosis.',
    relatedDocs,
  };
}
