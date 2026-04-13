import type { AxiosInstance } from 'axios';
import { buildSecurityCredential } from '../security.js';
import { ValidationError } from '../errors.js';
import { CommandID, IdentifierType } from '../constants.js';
import type { ResolvedConfig, BalanceOptions, BalanceResult } from '../types.js';

/**
 * Query the M-Pesa account balance for the configured shortcode.
 */
export async function balance(
  http: AxiosInstance,
  config: ResolvedConfig,
  opts: BalanceOptions,
): Promise<BalanceResult> {
  if (!opts.callbackUrl) {
    throw new ValidationError({
      message: 'callbackUrl is required for balance queries',
      code: 'MISSING_CALLBACK_URL',
      suggestion:
        'Balance results are delivered via callback. ' +
        'For local dev, use ngrok: npx ngrok http 3000.',
    });
  }

  const securityCredential =
    config.securityCredential ??
    buildSecurityCredential(config.initiatorPassword, config.certPath);

  const { data } = await http.post('/mpesa/accountbalance/v1/query', {
    Initiator: config.initiatorName,
    SecurityCredential: securityCredential,
    CommandID: CommandID.AccountBalance,
    PartyA: config.b2cShortcode,
    IdentifierType: IdentifierType.Shortcode,
    Remarks: 'Balance query',
    QueueTimeOutURL: opts.timeoutUrl ?? opts.callbackUrl,
    ResultURL: opts.callbackUrl,
  });

  return {
    conversationId: data.ConversationID,
    originatorConversationId: data.OriginatorConversationID,
    status: 'queued',
    raw: data,
  };
}
