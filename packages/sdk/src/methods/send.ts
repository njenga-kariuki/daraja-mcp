import type { AxiosInstance } from 'axios';
import { normalizePhone } from '../phone.js';
import { buildSecurityCredential } from '../security.js';
import { ValidationError } from '../errors.js';
import { SEND_TYPE_MAP, CommandID } from '../constants.js';
import type { ResolvedConfig, SendOptions, SendResult } from '../types.js';

/**
 * Send money from business to customer (B2C).
 *
 * SecurityCredential is auto-generated from the initiator password and
 * Safaricom's public certificate. The sandbox cert is bundled with the SDK.
 */
export async function send(
  http: AxiosInstance,
  config: ResolvedConfig,
  opts: SendOptions,
): Promise<SendResult> {
  if (!opts.amount || opts.amount < 1 || !Number.isInteger(opts.amount)) {
    throw new ValidationError({
      message: `Invalid amount: ${opts.amount}`,
      code: 'INVALID_AMOUNT',
      suggestion: 'Amount must be a positive whole number (KES).',
    });
  }
  if (!opts.phone) {
    throw new ValidationError({
      message: 'Phone number is required',
      code: 'MISSING_PHONE',
      suggestion: 'Provide the recipient phone number.',
    });
  }
  if (!opts.callbackUrl) {
    throw new ValidationError({
      message: 'callbackUrl is required for B2C payments',
      code: 'MISSING_CALLBACK_URL',
      suggestion:
        'B2C payments are async — Daraja sends the result to your callback URL. ' +
        'For local dev, use ngrok: npx ngrok http 3000, then pass the https URL. ' +
        'Example: mpesa.send({ amount: 100, phone: "0712345678", callbackUrl: "https://abc.ngrok-free.app/callback" })',
    });
  }

  const phone = normalizePhone(opts.phone);
  const commandID = SEND_TYPE_MAP[opts.type ?? 'business'] ?? CommandID.BusinessPayment;
  const securityCredential =
    config.securityCredential ??
    buildSecurityCredential(config.initiatorPassword, config.certPath);

  const { data } = await http.post('/mpesa/b2c/v1/paymentrequest', {
    InitiatorName: config.initiatorName,
    SecurityCredential: securityCredential,
    CommandID: commandID,
    Amount: String(opts.amount),
    PartyA: config.b2cShortcode,
    PartyB: phone,
    Remarks: opts.remarks ?? 'Payment',
    QueueTimeOutURL: opts.timeoutUrl ?? opts.callbackUrl,
    ResultURL: opts.callbackUrl,
    Occasion: opts.occasion ?? '',
  });

  return {
    conversationId: data.ConversationID,
    originatorConversationId: data.OriginatorConversationID,
    status: 'queued',
    raw: data,
  };
}
