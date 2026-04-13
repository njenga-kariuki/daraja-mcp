import type { AxiosInstance } from 'axios';
import { createHttpClient } from './auth.js';
import { resolveConfig } from './config.js';
import { collect } from './methods/collect.js';
import { send } from './methods/send.js';
import { status } from './methods/status.js';
import { balance } from './methods/balance.js';
import { reverse } from './methods/reverse.js';
import { qr } from './methods/qr.js';
import type {
  MpesaConfig,
  ResolvedConfig,
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

/**
 * M-Pesa client with 6 intent-based methods.
 *
 * Zero-config for sandbox — all test credentials are pre-loaded.
 * Only consumerKey + consumerSecret are required.
 *
 * ```typescript
 * const mpesa = createClient({
 *   consumerKey: process.env.DARAJA_CONSUMER_KEY,
 *   consumerSecret: process.env.DARAJA_CONSUMER_SECRET,
 * });
 *
 * const payment = await mpesa.collect({ amount: 100, phone: '0712345678' });
 * ```
 */
export class MpesaClient {
  private readonly http: AxiosInstance;
  private readonly config: ResolvedConfig;

  constructor(opts: MpesaConfig = {}) {
    this.config = resolveConfig(opts);
    this.http = createHttpClient(this.config);
  }

  /** Current environment: 'sandbox' or 'production'. */
  get env(): string {
    return this.config.env;
  }

  /**
   * Collect a payment via STK Push.
   *
   * The customer receives a PIN prompt on their phone. By default, auto-polls
   * until the transaction resolves (no callback URL needed).
   *
   * ```typescript
   * const payment = await mpesa.collect({ amount: 100, phone: '0712345678' });
   * console.log(payment.status); // 'completed' | 'cancelled' | 'failed'
   * ```
   */
  collect(opts: CollectOptions): Promise<CollectResult> {
    return collect(this.http, this.config, opts);
  }

  /**
   * Send money from business to customer (B2C).
   *
   * SecurityCredential is auto-generated. Requires a callback URL because
   * B2C results are delivered asynchronously.
   *
   * ```typescript
   * const transfer = await mpesa.send({
   *   amount: 1000,
   *   phone: '0712345678',
   *   callbackUrl: 'https://example.com/callback',
   * });
   * ```
   */
  send(opts: SendOptions): Promise<SendResult> {
    return send(this.http, this.config, opts);
  }

  /**
   * Query the status of an M-Pesa transaction.
   *
   * ```typescript
   * const result = await mpesa.status({
   *   transactionId: 'QKJ41HAY4I',
   *   callbackUrl: 'https://example.com/callback',
   * });
   * ```
   */
  status(opts: StatusOptions): Promise<StatusResult> {
    return status(this.http, this.config, opts);
  }

  /**
   * Query the M-Pesa account balance.
   *
   * ```typescript
   * const result = await mpesa.balance({
   *   callbackUrl: 'https://example.com/callback',
   * });
   * ```
   */
  balance(opts: BalanceOptions): Promise<BalanceResult> {
    return balance(this.http, this.config, opts);
  }

  /**
   * Reverse an M-Pesa transaction.
   *
   * ```typescript
   * const result = await mpesa.reverse({
   *   transactionId: 'QKJ41HAY4I',
   *   amount: 100,
   *   callbackUrl: 'https://example.com/callback',
   * });
   * ```
   */
  reverse(opts: ReverseOptions): Promise<ReverseResult> {
    return reverse(this.http, this.config, opts);
  }

  /**
   * Generate a Dynamic QR code for M-Pesa payment.
   *
   * ```typescript
   * const { qrCode } = await mpesa.qr({ amount: 100 });
   * // qrCode is a base64-encoded PNG
   * ```
   */
  qr(opts: QrOptions): Promise<QrResult> {
    return qr(this.http, this.config, opts);
  }
}
