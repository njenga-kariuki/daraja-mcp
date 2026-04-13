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
    });
  }
  if (!opts.amount || opts.amount < 1) {
    throw new ValidationError({
      message: `Invalid amount: ${opts.amount}`,
      code: 'INVALID_AMOUNT',
      suggestion: 'Amount must be a positive number. Cannot exceed the original transaction amount.',
    });
  }
  if (!opts.callbackUrl) {
    throw new ValidationError({
      message: 'callbackUrl is required for reversals',
      code: 'MISSING_CALLBACK_URL',
      suggestion:
        'Reversal results are delivered via callback. ' +
        'For local dev, use ngrok: npx ngrok http 3000.',
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
