import type { AxiosInstance } from 'axios';
import { buildSecurityCredential } from '../security.js';
import { ValidationError } from '../errors.js';
import { CommandID, IdentifierType } from '../constants.js';
import type { ResolvedConfig, StatusOptions, StatusResult } from '../types.js';

/**
 * Query the status of an M-Pesa transaction.
 *
 * Useful when callbacks are missed or for reconciliation.
 * For STK Push payments, mpesa.collect() with poll:true handles this automatically.
 */
export async function status(
  http: AxiosInstance,
  config: ResolvedConfig,
  opts: StatusOptions,
): Promise<StatusResult> {
  if (!opts.transactionId) {
    throw new ValidationError({
      message: 'transactionId is required',
      code: 'MISSING_TRANSACTION_ID',
      suggestion: 'Provide the M-Pesa transaction ID (e.g., "QKJ41HAY4I").',
    });
  }
  if (!opts.callbackUrl) {
    throw new ValidationError({
      message: 'callbackUrl is required for status queries',
      code: 'MISSING_CALLBACK_URL',
      suggestion:
        'Transaction status results are delivered via callback. ' +
        'For local dev, use ngrok: npx ngrok http 3000.',
    });
  }

  const securityCredential =
    config.securityCredential ??
    buildSecurityCredential(config.initiatorPassword, config.certPath);

  const { data } = await http.post('/mpesa/transactionstatus/v1/query', {
    Initiator: config.initiatorName,
    SecurityCredential: securityCredential,
    CommandID: CommandID.TransactionStatusQuery,
    TransactionID: opts.transactionId,
    PartyA: config.b2cShortcode,
    IdentifierType: IdentifierType.Shortcode,
    ResultURL: opts.callbackUrl,
    QueueTimeOutURL: opts.timeoutUrl ?? opts.callbackUrl,
    Remarks: 'Status query',
    Occasion: '',
  });

  return {
    conversationId: data.ConversationID,
    originatorConversationId: data.OriginatorConversationID,
    status: 'queued',
    raw: data,
  };
}
