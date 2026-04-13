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
  },
  '1001': {
    errorCode: '1001',
    meaning: 'USSD session in progress',
    rootCause:
      'The customer has an active USSD session (e.g., checking balance, another STK prompt) that blocks the new STK Push.',
    fix: 'Wait 2-3 minutes for the existing session to expire, then retry. Show a "please wait" message to the user.',
  },
  '1025': {
    errorCode: '1025',
    meaning: 'STK Push delivery failed',
    rootCause:
      'The STK prompt could not be delivered. Most common cause: TransactionDesc exceeds 182 characters (including whitespace).',
    fix: 'Shorten your TransactionDesc to under 182 characters. If using the SDK, this is handled automatically. Also check AccountReference is under 12 characters.',
    codeExample:
      "await mpesa.collect({ amount: 100, phone: '0712345678', description: 'Payment' }); // max 13 chars",
  },
  '1032': {
    errorCode: '1032',
    meaning: 'Request cancelled by user',
    rootCause:
      'The customer either: (1) pressed Cancel on the STK prompt, (2) entered wrong PIN, or (3) the prompt timed out without response.',
    fix: 'This is expected user behavior. Show a "Payment cancelled" message and offer a retry button. If recurring, check if the user is experiencing the prompt at all.',
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
  },
  '2001': {
    errorCode: '2001',
    meaning: 'Invalid initiator credentials',
    rootCause:
      'The initiator name or password is wrong. For B2C: check initiatorName and initiatorPassword. For STK Push: this means wrong M-Pesa PIN (customer-side).',
    fix: 'For B2C: verify MPESA_INITIATOR_NAME and MPESA_INITIATOR_PASSWORD match your Daraja app credentials. For sandbox, use "testapi" / "Safaricom999!*!".',
  },
  '9999': {
    errorCode: '9999',
    meaning: 'STK Push delivery failed (system error)',
    rootCause: 'Similar to 1025 — the STK prompt failed to deliver. Can also indicate a Daraja system issue.',
    fix: 'Check TransactionDesc length (max 182 chars), verify phone number format, and retry. If persistent, Daraja may be experiencing downtime.',
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
