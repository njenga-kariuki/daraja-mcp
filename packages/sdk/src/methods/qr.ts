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
  if (!opts.amount || opts.amount < 1) {
    throw new ValidationError({
      message: `Invalid amount: ${opts.amount}`,
      code: 'INVALID_AMOUNT',
      suggestion: 'Amount must be a positive number.',
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
