import type { AxiosInstance } from 'axios';
import { buildSecurityCredential } from '../security.js';
import { ValidationError } from '../errors.js';
import { CommandID } from '../constants.js';
import type { ResolvedConfig, ReverseOptions, ReverseResult } from '../types.js';

/**
 * Reverse an M-Pesa transaction.
 */
export async function reverse(
  http: AxiosInstance,
  config: ResolvedConfig,
  opts: ReverseOptions,
): Promise<ReverseResult> {
  if (!opts.transactionId) {
    throw new ValidationError({
      message: 'transactionId is required',
      code: 'MISSING_TRANSACTION_ID',
      suggestion: 'Provide the M-Pesa transaction ID to reverse.',
      prevention: 'Persist the transaction ID returned from the original payment at the time of the transaction. Reversals require the exact ID from the paid transaction.',
    });
  }
  if (!opts.amount || opts.amount < 1 || !Number.isInteger(opts.amount)) {
    throw new ValidationError({
      message: `Invalid amount: ${opts.amount}`,
      code: 'INVALID_AMOUNT',
      suggestion: 'Amount must be a positive whole number (KES). Cannot exceed the original transaction amount.',
      prevention: 'Look up the original transaction amount from your records and pass it here exactly. Rounding drift between systems is a common cause of reversal failures.',
    });
  }
  if (opts.amount > 150_000) {
    throw new ValidationError({
      message: `Amount too high: ${opts.amount} (max 150,000 KES per reversal)`,
      code: 'AMOUNT_TOO_HIGH',
      suggestion: 'Reversals cap at KES 150,000 per transaction. For larger amounts, the original transaction itself would have been split — reverse each piece separately.',
      prevention: 'If you built split-payment handling for the original collect/send, mirror it in your reversal flow: reverse each leg with its own transactionId and amount.',
    });
  }
  if (!opts.callbackUrl) {
    throw new ValidationError({
      message: 'callbackUrl is required for reversals',
      code: 'MISSING_CALLBACK_URL',
      suggestion:
        'Reversal results are delivered via callback. ' +
        'For local dev, use ngrok: npx ngrok http 3000.',
      prevention: 'Expose a dedicated /callbacks/reversal endpoint wrapped with verifyCallback() from the SDK. Compose the URL from MPESA_CALLBACK_BASE_URL in your environment.',
    });
  }

  const securityCredential =
    config.securityCredential ??
    buildSecurityCredential(config.initiatorPassword, config.certPath);

  const { data } = await http.post('/mpesa/reversal/v1/request', {
    Initiator: config.initiatorName,
    SecurityCredential: securityCredential,
    CommandID: CommandID.TransactionReversal,
    TransactionID: opts.transactionId,
    Amount: String(opts.amount),
    ReceiverParty: config.b2cShortcode,
    RecieverIdentifierType: '11',
    ResultURL: opts.callbackUrl,
    QueueTimeOutURL: opts.timeoutUrl ?? opts.callbackUrl,
    Remarks: 'Reversal',
    Occasion: '',
  });

  return {
    conversationId: data.ConversationID,
    originatorConversationId: data.OriginatorConversationID,
    status: 'queued',
    raw: data,
  };
}
