import { MpesaClient } from './client.js';
import type { MpesaConfig } from './types.js';

/**
 * Create an M-Pesa client.
 *
 * Zero-config for sandbox — only consumerKey + consumerSecret are required.
 * Everything else has sandbox defaults.
 *
 * ```typescript
 * import { createClient } from '@daraja-kit/sdk';
 *
 * const mpesa = createClient({
 *   consumerKey: process.env.DARAJA_CONSUMER_KEY,
 *   consumerSecret: process.env.DARAJA_CONSUMER_SECRET,
 * });
 *
 * // Collect a payment (STK Push + auto-polling)
 * const payment = await mpesa.collect({ amount: 100, phone: '0712345678' });
 *
 * // Send money (B2C)
 * const transfer = await mpesa.send({
 *   amount: 1000,
 *   phone: '0712345678',
 *   callbackUrl: 'https://example.com/callback',
 * });
 * ```
 */
export function createClient(opts: MpesaConfig = {}): MpesaClient {
  return new MpesaClient(opts);
}

// Re-export everything consumers might need.
export { MpesaClient } from './client.js';
export type {
  MpesaConfig,
  CollectOptions,
  CollectResult,
  SendOptions,
  SendResult,
  StatusOptions,
  StatusResult,
  BalanceOptions,
  BalanceResult,
  ReverseOptions,
  ReverseResult,
  QrOptions,
  QrResult,
} from './types.js';
export {
  MpesaError,
  AuthError,
  ValidationError,
  TimeoutError,
  InsufficientFundsError,
} from './errors.js';
export { SANDBOX } from './constants.js';
export { verifyCallback } from './callback.js';
export type { VerifyOptions, VerifyResult } from './callback.js';
