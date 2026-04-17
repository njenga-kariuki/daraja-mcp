/**
 * Base error for all M-Pesa SDK errors.
 * Every error includes a `suggestion` field — plain English, actionable,
 * readable by both humans and AI agents.
 */
export class MpesaError extends Error {
  /** Machine-readable code: AUTH_FAILED, INVALID_PHONE, USER_CANCELLED, etc. */
  readonly code: string;
  /** What to do about it — the key to agent-friendly errors. */
  readonly suggestion: string;
  /** How to prevent this error from happening again — actionable code patterns and practices. */
  readonly prevention?: string;
  /** Raw Daraja error code (e.g., "1032", "404.001.04"). */
  readonly darajaCode?: string;
  /** HTTP status code if applicable. */
  readonly httpStatus?: number;
  /** Full Daraja response body. */
  readonly raw?: Record<string, unknown>;

  constructor(opts: {
    message: string;
    code: string;
    suggestion: string;
    prevention?: string;
    darajaCode?: string;
    httpStatus?: number;
    raw?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(opts.message, { cause: opts.cause });
    this.name = 'MpesaError';
    this.code = opts.code;
    this.suggestion = opts.suggestion;
    this.prevention = opts.prevention;
    this.darajaCode = opts.darajaCode;
    this.httpStatus = opts.httpStatus;
    this.raw = opts.raw;
  }
}

export class AuthError extends MpesaError {
  constructor(opts: Omit<ConstructorParameters<typeof MpesaError>[0], 'code'>) {
    super({ ...opts, code: 'AUTH_FAILED' });
    this.name = 'AuthError';
  }
}

export class ValidationError extends MpesaError {
  constructor(opts: Omit<ConstructorParameters<typeof MpesaError>[0], 'code'> & { code?: string }) {
    super({ ...opts, code: opts.code ?? 'VALIDATION_ERROR' });
    this.name = 'ValidationError';
  }
}

export class TimeoutError extends MpesaError {
  constructor(opts: Omit<ConstructorParameters<typeof MpesaError>[0], 'code'>) {
    super({ ...opts, code: 'TIMEOUT' });
    this.name = 'TimeoutError';
  }
}

export class InsufficientFundsError extends MpesaError {
  constructor(opts: Omit<ConstructorParameters<typeof MpesaError>[0], 'code'>) {
    super({ ...opts, code: 'INSUFFICIENT_FUNDS' });
    this.name = 'InsufficientFundsError';
  }
}

/**
 * Maps Daraja result codes to structured SDK errors.
 * This is the core of the "self-healing errors" design.
 */
export function mapDarajaError(
  resultCode: string | number,
  resultDesc?: string,
  raw?: Record<string, unknown>,
): MpesaError {
  const code = String(resultCode);
  const desc = resultDesc ?? 'Unknown error';

  const map: Record<string, () => MpesaError> = {
    '1': () =>
      new InsufficientFundsError({
        message: `Insufficient M-Pesa balance: ${desc}`,
        suggestion: 'The customer does not have enough M-Pesa balance. Ask them to top up and retry.',
        prevention: 'Display the required amount before initiating payment so customers can verify their balance. Consider offering split payment options for larger amounts.',
        darajaCode: code,
        raw,
      }),
    '03': () =>
      new ValidationError({
        message: `Amount below minimum: ${desc}`,
        code: 'AMOUNT_TOO_LOW',
        suggestion: 'The amount is less than the minimum allowed (KES 1 for most APIs). Increase the amount to at least KES 1.',
        prevention: 'Add server-side validation: `if (amount < 1) throw new Error(\'Minimum amount is KES 1\')`. The SDK validates this, but catching it early gives better UX.',
        darajaCode: code,
        raw,
      }),
    '04': () =>
      new ValidationError({
        message: `Amount above maximum: ${desc}`,
        code: 'AMOUNT_TOO_HIGH',
        suggestion: 'The amount exceeds the per-transaction limit (KES 150,000 for STK Push). Reduce the amount or split into multiple transactions.',
        prevention: 'Add server-side amount validation before calling mpesa.collect(). Enforce: `if (amount > 150000) throw new Error(\'Maximum KES 150,000 per transaction\')`. Split larger payments.',
        darajaCode: code,
        raw,
      }),
    '05': () =>
      new TimeoutError({
        message: `Transaction timeout: ${desc}`,
        suggestion: 'The transaction took too long to process on Daraja\'s side. This is transient — retry after a few seconds.',
        prevention: 'Implement retry with exponential backoff: wait 2s, 4s, 8s between retries. Set a maximum of 3 retries. Use the SDK\'s polling mechanism which handles this for STK Push.',
        darajaCode: code,
        raw,
      }),
    '08': () =>
      new MpesaError({
        message: `Daily transaction limit exceeded: ${desc}`,
        code: 'DAILY_LIMIT',
        suggestion: 'The customer has exceeded their daily M-Pesa transaction limit. They must wait until the next day or use a different payment method.',
        prevention: 'Track cumulative daily amounts per customer and warn them before they approach the limit. M-Pesa daily limits vary by customer tier.',
        darajaCode: code,
        raw,
      }),
    '10': () =>
      new ValidationError({
        message: `Phone not registered on M-Pesa: ${desc}`,
        code: 'NOT_REGISTERED',
        suggestion: 'The phone number is not registered for M-Pesa. The customer must register for M-Pesa at a Safaricom agent first.',
        prevention: 'Validate phone numbers against the M-Pesa network before initiating payment if possible, or handle this error gracefully with a clear message to the customer.',
        darajaCode: code,
        raw,
      }),
    '11': () =>
      new MpesaError({
        message: `Daraja system error: ${desc}`,
        code: 'SYSTEM_ERROR',
        suggestion: 'Internal Daraja system error. This is transient — retry after a short delay. If persistent, check Daraja status or contact Safaricom support.',
        prevention: 'Implement circuit breaker pattern: after 3 consecutive system errors within 60 seconds, pause requests for 30 seconds before retrying.',
        darajaCode: code,
        raw,
      }),
    '12': () =>
      new ValidationError({
        message: `Transaction details mismatch: ${desc}`,
        code: 'DETAILS_MISMATCH',
        suggestion: 'Transaction details do not match — e.g., wrong shortcode/passkey combination. Verify your shortcode, passkey, and other parameters are correct for your environment (sandbox vs production).',
        prevention: 'Verify shortcode, passkey, and environment match. Use daraja_preflight to validate configuration before deployment.',
        darajaCode: code,
        raw,
      }),
    '29': () =>
      new MpesaError({
        message: `Daraja system downtime: ${desc}`,
        code: 'SYSTEM_DOWNTIME',
        suggestion: 'Daraja is undergoing maintenance or experiencing an outage. Do not retry aggressively — wait a few minutes and try again.',
        prevention: 'Implement a health check endpoint that monitors Daraja availability. Queue payments during downtime and process when service resumes.',
        darajaCode: code,
        raw,
      }),
    '06': () =>
      new MpesaError({
        message: `Confirmation failed: ${desc}`,
        code: 'CONFIRMATION_FAILED',
        suggestion:
          'M-Pesa could not confirm the transaction downstream. Retry once after a short delay. If it persists, the receiving shortcode may have a provisioning issue — escalate to apisupport@safaricom.co.ke.',
        prevention:
          'Treat 06 as transient on the first retry. Page your ops team on repeated 06 from the same shortcode — it typically signals a Safaricom-side provisioning problem, not a code bug.',
        darajaCode: code,
        raw,
      }),
    '32': () =>
      new MpesaError({
        message: `Service not activated on shortcode: ${desc}`,
        code: 'SERVICE_NOT_ACTIVATED',
        suggestion:
          'Your paybill/till does not have this API enabled at the Safaricom side. Email apisupport@safaricom.co.ke requesting activation for your shortcode. Include your app name and go-live approval.',
        prevention:
          'Verify every API you intend to use is enabled on your shortcode before go-live. Use daraja_preflight to catch missing enablement early.',
        darajaCode: code,
        raw,
      }),
    '33': () =>
      new MpesaError({
        message: `Go-live not approved: ${desc}`,
        code: 'GO_LIVE_NOT_APPROVED',
        suggestion:
          'You are calling production APIs before Safaricom has approved go-live. Complete the go-live checklist (daraja_go_live) and submit. Approval takes 3-7 business days. Until then, keep environment on sandbox.',
        prevention:
          'Keep `environment: "sandbox"` in production config until the approval email arrives, then flip the flag. Do not split-deploy with half-approved credentials.',
        darajaCode: code,
        raw,
      }),
    '34': () =>
      new MpesaError({
        message: `Processing delay: ${desc}`,
        code: 'PROCESSING_DELAY',
        suggestion:
          'Do NOT retry — this is slow processing, not failure. Retrying creates a duplicate (error 35) and real money movement on both paths. Wait 60 seconds and query status instead.',
        prevention:
          'Exclude code 34 from retry logic. A retry-on-34 policy is the #1 cause of double-charges in custom Daraja integrations. Let the callback resolve the state.',
        darajaCode: code,
        raw,
      }),
    '43': () =>
      new ValidationError({
        message: `Duplicate MerchantRequestID: ${desc}`,
        code: 'DUPLICATE_MERCHANT_REQUEST_ID',
        suggestion:
          'Your code sent the same MerchantRequestID twice. Generate a unique ID per request using crypto.randomUUID(). The SDK does this automatically.',
        prevention:
          'Never derive MerchantRequestID from deterministic data (user ID, timestamp, order number). Always use crypto.randomUUID(). Retries must generate a new ID.',
        darajaCode: code,
        raw,
      }),
    '500.001.1001': () =>
      new AuthError({
        message: `Invalid initiator information: ${desc}`,
        suggestion:
          'Your SecurityCredential decrypts to the wrong password on the Safaricom side. Verify you are using the env-matching certificate — sandbox uses SandboxCertificate.cer, production uses ProductionCertificate.cer.',
        prevention:
          'Let the SDK handle certificate selection via createClient({ environment }). Never hand-bake SecurityCredential generation. Rotate production credentials via the portal, not manually.',
        darajaCode: code,
        raw,
      }),
    '404.001.04': () =>
      new MpesaError({
        message: `Resource not found (namespaced): ${desc}`,
        code: 'NOT_FOUND_NAMESPACED',
        suggestion:
          'The endpoint URL or request body is wrong. Most common cause: mixing sandbox and production base URLs. Use createClient({ environment }) to pick the correct base URL automatically.',
        prevention:
          'Use createClient({ environment }) and let the SDK pick the base URL. If calling raw HTTP, centralize URL selection in one config module driven by NODE_ENV.',
        darajaCode: code,
        raw,
      }),
    '35': () =>
      new MpesaError({
        message: `Duplicate transaction: ${desc}`,
        code: 'DUPLICATE_TRANSACTION',
        suggestion: 'A transaction with the same parameters was just processed. Wait at least 30 seconds before retrying the same phone + amount combination.',
        prevention: 'Implement request deduplication: track phone+amount combinations with timestamps, reject duplicates within a 30-second window. Example: `const key = `${phone}:${amount}`; if (recent.has(key)) return;`',
        darajaCode: code,
        raw,
      }),
    '36': () =>
      new AuthError({
        message: `Incorrect credentials: ${desc}`,
        suggestion: 'Wrong passkey or shortcode. Verify your passkey and shortcode match your environment. For sandbox, use the sandbox passkey.',
        prevention: 'Use environment variables for all credentials. Run daraja_preflight before each deployment to verify credentials are valid.',
        darajaCode: code,
        raw,
      }),
    '41': () =>
      new ValidationError({
        message: `Invalid phone number format: ${desc}`,
        code: 'INVALID_MSISDN',
        suggestion: 'The phone number format is invalid. Use format 254XXXXXXXXX (12 digits, starting with 254). The SDK normalizes automatically if you use mpesa.collect().',
        prevention: 'Always use the SDK\'s phone normalization (pass any Kenyan format to mpesa.collect()). If calling APIs directly, normalize to 254XXXXXXXXX format first.',
        darajaCode: code,
        raw,
      }),
    '42': () =>
      new AuthError({
        message: `Passkey/paybill mismatch: ${desc}`,
        suggestion: 'The passkey does not correspond to your shortcode. Ensure the passkey matches your shortcode. For sandbox, use the sandbox passkey with shortcode 174379.',
        prevention: 'Keep a configuration file mapping shortcodes to passkeys per environment. Use daraja_setup to verify your pairing.',
        darajaCode: code,
        raw,
      }),
    '99': () =>
      new MpesaError({
        message: `No transaction found: ${desc}`,
        code: 'TRANSACTION_NOT_FOUND',
        suggestion: 'The STK Query could not find the transaction. The STK prompt was likely not completed within 60 seconds, or the CheckoutRequestID is invalid. The SDK handles polling automatically — if you see this, the payment timed out.',
        prevention: 'Set appropriate timeout expectations in your UI (60 seconds for STK Push). The SDK\'s auto-polling handles this — if you see this error, the customer didn\'t complete the prompt.',
        darajaCode: code,
        raw,
      }),
    '1001': () =>
      new MpesaError({
        message: `USSD session in progress: ${desc}`,
        code: 'USSD_BUSY',
        suggestion:
          'The customer has an active USSD session blocking the STK prompt. Wait 2-3 minutes and retry.',
        prevention: 'Add a retry delay of 2-3 minutes for this specific error. Inform the user their phone has an active USSD session that must complete first.',
        darajaCode: code,
        raw,
      }),
    '1025': () =>
      new MpesaError({
        message: `STK Push delivery failed: ${desc}`,
        code: 'STK_DELIVERY_FAILED',
        suggestion:
          'The STK Push could not be delivered. Common cause: TransactionDesc exceeds 182 characters. Shorten the description and retry.',
        prevention: 'Keep TransactionDesc under 13 characters in your code. The SDK truncates automatically, but if calling APIs directly, enforce this limit.',
        darajaCode: code,
        raw,
      }),
    '1032': () =>
      new MpesaError({
        message: `Payment cancelled by user: ${desc}`,
        code: 'USER_CANCELLED',
        suggestion:
          'The customer cancelled the M-Pesa prompt or it timed out. You can retry with mpesa.collect().',
        prevention: 'Set reasonable timeout expectations in your UI. Consider offering an alternative payment method or retry button after 2 consecutive cancellations.',
        darajaCode: code,
        raw,
      }),
    '1037': () =>
      new TimeoutError({
        message: `Phone unreachable: ${desc}`,
        suggestion:
          "The customer's phone is off or unreachable (common with iOS eSIM). Ask them to check their phone and retry.",
        prevention: 'Inform users that their phone must be on and connected to the mobile network. Consider SMS follow-up or retry scheduling for B2C payments.',
        darajaCode: code,
        raw,
      }),
    '2001': () =>
      new AuthError({
        message: `Invalid credentials: ${desc}`,
        suggestion:
          'Wrong M-Pesa PIN entered too many times, or invalid initiator credentials. Check your initiatorName and initiatorPassword.',
        prevention: 'Store initiator credentials securely in environment variables. Rotate credentials periodically and test with daraja_preflight after rotation.',
        darajaCode: code,
        raw,
      }),
    '9999': () =>
      new MpesaError({
        message: `STK Push delivery failed: ${desc}`,
        code: 'STK_DELIVERY_FAILED',
        suggestion:
          'The STK Push could not be delivered. Check that TransactionDesc is under 182 characters and retry.',
        prevention: 'Keep TransactionDesc under 13 characters in your code. The SDK truncates automatically, but if calling APIs directly, enforce this limit.',
        darajaCode: code,
        raw,
      }),
  };

  if (map[code]) return map[code]();

  // Fallback for unknown codes
  return new MpesaError({
    message: `Daraja error ${code}: ${desc}`,
    code: 'DARAJA_ERROR',
    suggestion: `Daraja returned error code ${code}. Check the error-codes reference at knowledge/errors/error-codes.md for details.`,
    prevention: 'Check the error-codes reference for this specific code. If recurring, implement error-specific handling.',
    darajaCode: code,
    raw,
  });
}

/** Maps HTTP-level Daraja errors to SDK errors. */
export function mapHttpError(
  status: number,
  data?: Record<string, unknown>,
): MpesaError {
  if (status === 400) {
    const msg = (data?.errorMessage as string) ?? (data?.error_description as string) ?? 'Bad request';
    return new ValidationError({
      message: `Bad request: ${msg}`,
      suggestion:
        'Check that all required fields are present and correctly formatted. Common issues: phone number format (use 254XXXXXXXXX), amount must be a positive integer.',
      prevention: 'Validate all inputs before making API calls. Use the SDK methods which handle validation automatically.',
      httpStatus: status,
      raw: data,
    });
  }

  if (status === 401 || status === 403) {
    return new AuthError({
      message: 'Authentication failed',
      suggestion:
        'Invalid consumer key or secret. Get yours at developer.safaricom.co.ke → My Apps. Set DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET.',
      prevention: 'Store credentials in environment variables. Verify with daraja_preflight before deployment. Set up credential rotation reminders.',
      httpStatus: status,
      raw: data,
    });
  }

  if (status === 404) {
    return new MpesaError({
      message: 'Daraja endpoint not found',
      code: 'NOT_FOUND',
      suggestion:
        'The API endpoint was not found. Check that you are using the correct environment (sandbox vs production).',
      prevention: 'Use the SDK which auto-selects the correct endpoints. If calling APIs directly, verify you\'re using the correct base URL for your environment (sandbox vs production).',
      httpStatus: status,
      raw: data,
    });
  }

  if (status === 429) {
    return new MpesaError({
      message: 'Rate limited by Daraja',
      code: 'RATE_LIMITED',
      suggestion:
        'Too many requests. Wait a few seconds and retry. ' +
        'If you are using the shared sandbox credentials, create your own free Daraja app at developer.safaricom.co.ke for dedicated rate limits. ' +
        'Use the daraja_setup tool for guided instructions.',
      prevention: 'Implement exponential backoff with jitter. Create your own Daraja app at developer.safaricom.co.ke for dedicated rate limits instead of using shared sandbox credentials.',
      httpStatus: status,
      raw: data,
    });
  }

  if (status >= 500) {
    return new MpesaError({
      message: `Daraja server error (${status})`,
      code: 'SERVER_ERROR',
      suggestion:
        'Daraja is experiencing issues. This is usually temporary. Retry after a few seconds. If persistent, check Daraja status or contact Safaricom support.',
      prevention: 'Implement retry with exponential backoff (max 3 retries). Add circuit breaker logic to pause after repeated failures.',
      httpStatus: status,
      raw: data,
    });
  }

  return new MpesaError({
    message: `Unexpected HTTP ${status}`,
    code: 'HTTP_ERROR',
    suggestion: `Received unexpected HTTP status ${status} from Daraja.`,
    httpStatus: status,
    raw: data,
  });
}
