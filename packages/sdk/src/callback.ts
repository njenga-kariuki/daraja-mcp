/**
 * Safaricom production API IP addresses for callback verification.
 * Source: Daraja documentation — whitelist these IPs in production.
 */
const SAFARICOM_IPS = [
  '196.201.214.200',
  '196.201.214.206',
  '196.201.213.114',
  '196.201.214.207',
  '196.201.214.208',
  '196.201.213.44',
  '196.201.212.127',
  '196.201.212.128',
  '196.201.212.129',
  '196.201.212.132',
  '196.201.212.136',
  '196.201.212.138',
];

/** In-memory deduplication store. */
const processedIds = new Map<string, number>();
const DEFAULT_TTL = 300_000; // 5 minutes

export interface VerifyOptions {
  /** Source IP address of the request (e.g., req.ip). */
  ip?: string;
  /** Custom allowed IPs. Default: Safaricom production IPs. Use 'any' to skip IP check. */
  allowedIPs?: string[] | 'any';
  /** TTL for idempotency tracking in ms. Default: 300_000 (5 min). Set to 0 to disable. */
  idempotencyTTL?: number;
}

export interface VerifyResult {
  /** Whether the callback passed all verification checks. */
  valid: boolean;
  /** Whether this is a duplicate callback (already processed). */
  duplicate: boolean;
  /** Verified callback data (only set if valid). */
  data: {
    resultCode: number;
    resultDesc: string;
    transactionId?: string;
    conversationId?: string;
    raw: Record<string, unknown>;
  } | null;
  /** Reason for rejection (only set if !valid). */
  reason?: string;
}

/**
 * Verify and parse a Daraja callback payload.
 *
 * Framework-agnostic utility that handles:
 * 1. **IP verification** — ensures the callback originates from Safaricom's servers
 * 2. **Payload validation** — extracts data from both STK Push and B2C/Status callback shapes
 * 3. **Idempotency** — detects duplicate callbacks via in-memory deduplication
 *
 * ```typescript
 * import { verifyCallback } from '@daraja-kit/sdk';
 *
 * app.post('/callback', (req, res) => {
 *   const result = verifyCallback(req.body, { ip: req.ip });
 *
 *   if (!result.valid) return res.status(403).json({ error: result.reason });
 *   if (result.duplicate) return res.status(200).json({ status: 'already processed' });
 *
 *   // Process result.data
 *   console.log(result.data.resultCode, result.data.transactionId);
 *   res.status(200).json({ status: 'received' });
 * });
 * ```
 */
export function verifyCallback(
  body: Record<string, unknown>,
  options: VerifyOptions = {},
): VerifyResult {
  const { ip, allowedIPs = SAFARICOM_IPS, idempotencyTTL = DEFAULT_TTL } = options;

  // 1. IP verification (skip if no IP provided or allowedIPs is 'any')
  if (ip && allowedIPs !== 'any') {
    // Handle proxied IPs (X-Forwarded-For can have multiple IPs)
    const sourceIP = ip.replace(/^::ffff:/, ''); // Strip IPv6 prefix
    if (!allowedIPs.includes(sourceIP)) {
      return { valid: false, duplicate: false, data: null, reason: `IP ${sourceIP} not in allowed list` };
    }
  }

  // 2. Payload validation — extract result from Daraja callback structure
  // Daraja callbacks come in two shapes:
  //   STK Push query: { Body: { stkCallback: { ResultCode, ResultDesc, ... } } }
  //   B2C/Status/etc: { Result: { ResultCode, ResultDesc, ConversationID, TransactionID, ... } }
  let resultCode: number;
  let resultDesc: string;
  let conversationId: string | undefined;
  let transactionId: string | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stkCallback = (body as any)?.Body?.stkCallback;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resultObj = (body as any)?.Result;

  if (stkCallback) {
    resultCode = Number(stkCallback.ResultCode);
    resultDesc = String(stkCallback.ResultDesc ?? '');
    conversationId = stkCallback.CheckoutRequestID;
    transactionId = stkCallback.MerchantRequestID;
  } else if (resultObj) {
    resultCode = Number(resultObj.ResultCode);
    resultDesc = String(resultObj.ResultDesc ?? '');
    conversationId = resultObj.ConversationID;
    transactionId = resultObj.TransactionID;
  } else {
    return { valid: false, duplicate: false, data: null, reason: 'Unrecognized callback payload structure' };
  }

  if (typeof resultCode !== 'number' || isNaN(resultCode)) {
    return { valid: false, duplicate: false, data: null, reason: 'Missing or invalid ResultCode' };
  }

  // 3. Idempotency check
  const dedupeKey = conversationId ?? transactionId;
  let isDuplicate = false;

  if (dedupeKey && idempotencyTTL > 0) {
    const now = Date.now();
    if (processedIds.has(dedupeKey)) {
      isDuplicate = true;
    } else {
      processedIds.set(dedupeKey, now);
      // Cleanup expired entries
      for (const [key, timestamp] of processedIds) {
        if (now - timestamp > idempotencyTTL) processedIds.delete(key);
      }
    }
  }

  return {
    valid: true,
    duplicate: isDuplicate,
    data: {
      resultCode,
      resultDesc,
      transactionId,
      conversationId,
      raw: body,
    },
  };
}
