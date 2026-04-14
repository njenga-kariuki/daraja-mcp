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
    darajaCode?: string;
    httpStatus?: number;
    raw?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(opts.message, { cause: opts.cause });
    this.name = 'MpesaError';
    this.code = opts.code;
    this.suggestion = opts.suggestion;
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
        darajaCode: code,
        raw,
      }),
    '1001': () =>
      new MpesaError({
        message: `USSD session in progress: ${desc}`,
        code: 'USSD_BUSY',
        suggestion:
          'The customer has an active USSD session blocking the STK prompt. Wait 2-3 minutes and retry.',
        darajaCode: code,
        raw,
      }),
    '1025': () =>
      new MpesaError({
        message: `STK Push delivery failed: ${desc}`,
        code: 'STK_DELIVERY_FAILED',
        suggestion:
          'The STK Push could not be delivered. Common cause: TransactionDesc exceeds 182 characters. Shorten the description and retry.',
        darajaCode: code,
        raw,
      }),
    '1032': () =>
      new MpesaError({
        message: `Payment cancelled by user: ${desc}`,
        code: 'USER_CANCELLED',
        suggestion:
          'The customer cancelled the M-Pesa prompt or it timed out. You can retry with mpesa.collect().',
        darajaCode: code,
        raw,
      }),
    '1037': () =>
      new TimeoutError({
        message: `Phone unreachable: ${desc}`,
        suggestion:
          "The customer's phone is off or unreachable (common with iOS eSIM). Ask them to check their phone and retry.",
        darajaCode: code,
        raw,
      }),
    '2001': () =>
      new AuthError({
        message: `Invalid credentials: ${desc}`,
        suggestion:
          'Wrong M-Pesa PIN entered too many times, or invalid initiator credentials. Check your initiatorName and initiatorPassword.',
        darajaCode: code,
        raw,
      }),
    '9999': () =>
      new MpesaError({
        message: `STK Push delivery failed: ${desc}`,
        code: 'STK_DELIVERY_FAILED',
        suggestion:
          'The STK Push could not be delivered. Check that TransactionDesc is under 182 characters and retry.',
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
      httpStatus: status,
      raw: data,
    });
  }

  if (status === 401 || status === 403) {
    return new AuthError({
      message: 'Authentication failed',
      suggestion:
        'Invalid consumer key or secret. Get yours at developer.safaricom.co.ke → My Apps. Set DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET.',
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
