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
      prevention: 'Validate amounts server-side: `Number.isInteger(amount) && amount >= 1`. For payroll/batch flows, validate every row before entering the send loop.',
    });
  }
  if (opts.amount > 150_000) {
    throw new ValidationError({
      message: `Amount too high: ${opts.amount} (max 150,000 KES per B2C transaction)`,
      code: 'AMOUNT_TOO_HIGH',
      suggestion: 'B2C transactions cap at KES 150,000 each. Split larger disbursements into multiple payments.',
      prevention: 'Enforce `amount <= 150_000` per payment in your batch builder. For large payroll runs, chunk each recipient into transactions at or below the cap.',
    });
  }
  if (!opts.phone) {
    throw new ValidationError({
      message: 'Phone number is required',
      code: 'MISSING_PHONE',
      suggestion: 'Provide the recipient phone number.',
      prevention: 'Require phone at the form/API boundary before calling the SDK. The SDK normalizes every Kenyan format, so validation on your side only needs to confirm presence.',
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
      prevention: 'Set MPESA_CALLBACK_BASE_URL in your environment and compose callback URLs from it. In production, point to your HTTPS endpoint; in dev, use ngrok. Never hardcode localhost URLs.',
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
