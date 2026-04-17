import type { AxiosInstance } from 'axios';
import { darajaTimestamp, stkPassword } from '../security.js';
import { normalizePhone } from '../phone.js';
import { ValidationError } from '../errors.js';
import { pollStkStatus } from '../polling.js';
import type { ResolvedConfig, CollectOptions, CollectResult } from '../types.js';

/**
 * Collect a payment via STK Push.
 *
 * The customer receives a PIN prompt on their phone. By default, the SDK
 * auto-polls the STK Query endpoint until the transaction resolves — no
 * callback URL needed.
 */
export async function collect(
  http: AxiosInstance,
  config: ResolvedConfig,
  opts: CollectOptions,
): Promise<CollectResult> {
  // Validate
  if (!opts.amount || opts.amount < 1 || !Number.isInteger(opts.amount)) {
    throw new ValidationError({
      message: `Invalid amount: ${opts.amount}`,
      code: 'INVALID_AMOUNT',
      suggestion: 'Amount must be a positive whole number (KES). M-Pesa does not support decimals.',
      prevention: 'Validate amounts server-side before calling the SDK: `Number.isInteger(amount) && amount >= 1`. Round or floor decimals with `Math.round(total)` or `Math.floor(total)` before passing in.',
    });
  }
  if (opts.amount > 150_000) {
    throw new ValidationError({
      message: `Amount too high: ${opts.amount} (max 150,000 KES per STK Push)`,
      code: 'AMOUNT_TOO_HIGH',
      suggestion: 'STK Push caps at KES 150,000 per transaction. Reduce the amount or split into multiple transactions.',
      prevention: 'Enforce `amount <= 150_000` on your server before calling mpesa.collect(). For payments above this cap, split into multiple transactions or use B2B/paybill flows.',
    });
  }
  if (!opts.phone) {
    throw new ValidationError({
      message: 'Phone number is required',
      code: 'MISSING_PHONE',
      suggestion: 'Provide the customer phone number. Any Kenyan format works: 0712345678, +254712345678, etc.',
      prevention: 'Require phone at the form/API boundary before calling the SDK. The SDK normalizes every Kenyan format, so validation on your side only needs to confirm presence.',
    });
  }

  const phone = normalizePhone(opts.phone);
  const timestamp = darajaTimestamp();
  const password = stkPassword(config.shortcode, config.passkey, timestamp);
  const reference = (opts.reference ?? 'Payment').slice(0, 12);
  const description = (opts.description ?? 'Payment').slice(0, 13);

  const { data } = await http.post('/mpesa/stkpush/v1/processrequest', {
    BusinessShortCode: config.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: String(opts.amount),
    PartyA: phone,
    PartyB: config.shortcode,
    PhoneNumber: phone,
    CallBackURL: config.callbackBaseUrl
      ? `${config.callbackBaseUrl}/callbacks/stkpush`
      : 'https://example.com/callback',
    AccountReference: reference,
    TransactionDesc: description,
  });

  const result: CollectResult = {
    id: data.CheckoutRequestID,
    merchantRequestId: data.MerchantRequestID,
    status: 'pending',
    phone,
    amount: opts.amount,
    raw: data,
  };

  // If polling is enabled (default), wait for the transaction to resolve.
  const shouldPoll = opts.poll !== false;
  if (shouldPoll) {
    return pollStkStatus(http, config, data.CheckoutRequestID, {
      interval: opts.pollInterval ?? 3000,
      timeout: opts.pollTimeout ?? 60_000,
    });
  }

  return result;
}
