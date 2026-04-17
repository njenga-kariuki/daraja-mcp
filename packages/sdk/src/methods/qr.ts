import type { AxiosInstance } from 'axios';
import { ValidationError } from '../errors.js';
import { QR_TYPE_MAP } from '../constants.js';
import type { ResolvedConfig, QrOptions, QrResult } from '../types.js';

/**
 * Generate a Dynamic QR code that customers scan in the M-Pesa app.
 * Returns a base64-encoded PNG image.
 */
export async function qr(
  http: AxiosInstance,
  config: ResolvedConfig,
  opts: QrOptions,
): Promise<QrResult> {
  if (!opts.amount || opts.amount < 1 || !Number.isInteger(opts.amount)) {
    throw new ValidationError({
      message: `Invalid amount: ${opts.amount}`,
      code: 'INVALID_AMOUNT',
      suggestion: 'Amount must be a positive whole number (KES).',
      prevention: 'Validate amounts server-side before generating a QR: `Number.isInteger(amount) && amount >= 1`. Decimals are not supported — round or floor first.',
    });
  }
  if (opts.amount > 150_000) {
    throw new ValidationError({
      message: `Amount too high: ${opts.amount} (max 150,000 KES per QR payment)`,
      code: 'AMOUNT_TOO_HIGH',
      suggestion: 'M-Pesa QR payments cap at KES 150,000 per transaction. Generate multiple QRs or reduce the amount.',
      prevention: 'Enforce `amount <= 150_000` on your server before calling mpesa.qr(). For higher-value transactions, consider paybill/till flows that support split payments.',
    });
  }

  const trxCode = QR_TYPE_MAP[opts.type ?? 'paybill'] ?? 'PB';

  const { data } = await http.post('/mpesa/qrcode/v1/generate', {
    MerchantName: opts.merchantName ?? config.shortcode,
    RefNo: (opts.reference ?? 'Payment').slice(0, 12),
    Amount: String(opts.amount),
    TrxCode: trxCode,
    CPI: config.shortcode,
    Size: String(opts.size ?? 300),
  });

  return {
    qrCode: data.QRCode,
    raw: data,
  };
}
