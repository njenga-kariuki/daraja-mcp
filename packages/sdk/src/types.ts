/** Configuration for creating an MpesaClient. */
export interface MpesaConfig {
  /** Daraja environment. Default: 'sandbox'. */
  env?: 'sandbox' | 'production';
  /** OAuth consumer key from developer.safaricom.co.ke */
  consumerKey?: string;
  /** OAuth consumer secret from developer.safaricom.co.ke */
  consumerSecret?: string;
  /** Lipa Na M-Pesa shortcode (paybill/till). Sandbox default: 174379 */
  shortcode?: string;
  /** Lipa Na M-Pesa passkey. Sandbox default provided. */
  passkey?: string;
  /** B2C initiator name. Sandbox default: testapi */
  initiatorName?: string;
  /** B2C initiator password. Sandbox default provided. */
  initiatorPassword?: string;
  /** B2C sending shortcode. Sandbox default: 600999 */
  b2cShortcode?: string;
  /** Path to Safaricom public certificate (.cer). Sandbox cert bundled. */
  certPath?: string;
  /** Pre-encrypted SecurityCredential (skips RSA if provided). */
  securityCredential?: string;
  /** Base URL for callback endpoints (e.g. https://abc.ngrok-free.app). */
  callbackBaseUrl?: string;
  /** HTTP request timeout in ms. Default: 30000. */
  timeout?: number;
}

/** Resolved internal config with all values populated. */
export interface ResolvedConfig {
  env: 'sandbox' | 'production';
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  initiatorName: string;
  initiatorPassword: string;
  b2cShortcode: string;
  certPath: string;
  securityCredential?: string;
  callbackBaseUrl?: string;
  timeout: number;
}

// ── Collect (STK Push) ──────────────────────────────────────────────────

export interface CollectOptions {
  /** Amount in KES (whole number, minimum 1). */
  amount: number;
  /** Customer phone number (any Kenyan format: 0712..., +254712..., 254712...). */
  phone: string;
  /** Account reference shown to customer. Max 12 chars. Default: "Payment". */
  reference?: string;
  /** Transaction description. Max 13 chars. Default: "Payment". */
  description?: string;
  /** Auto-poll STK Query for result. Default: true. */
  poll?: boolean;
  /** Milliseconds between polls. Default: 3000. */
  pollInterval?: number;
  /** Milliseconds before polling gives up. Default: 60000. */
  pollTimeout?: number;
}

export interface CollectResult {
  /** CheckoutRequestID — use for status queries. */
  id: string;
  /** MerchantRequestID from Daraja. */
  merchantRequestId: string;
  /** Current status of the payment. */
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  /** Confirmed amount (present when completed). */
  amount?: number;
  /** Normalized phone number. */
  phone?: string;
  /** M-Pesa receipt number (present when completed). */
  receipt?: string;
  /** Error code from Daraja (present when failed/cancelled). */
  errorCode?: string;
  /** Human-readable error explanation. */
  errorMessage?: string;
  /** Full raw Daraja response. */
  raw: Record<string, unknown>;
}

// ── Send (B2C) ──────────────────────────────────────────────────────────

export interface SendOptions {
  /** Amount in KES (whole number). */
  amount: number;
  /** Recipient phone number (any Kenyan format). */
  phone: string;
  /** Payment type. Default: 'business'. */
  type?: 'salary' | 'business' | 'promotion';
  /** Transaction remarks. */
  remarks?: string;
  /** Occasion description. */
  occasion?: string;
  /** URL where Daraja sends the result. Required for B2C. */
  callbackUrl: string;
  /** URL where Daraja sends timeout notifications. Defaults to callbackUrl. */
  timeoutUrl?: string;
}

export interface SendResult {
  /** ConversationID for tracking. */
  conversationId: string;
  /** OriginatorConversationID. */
  originatorConversationId: string;
  /** B2C is always async — queued means accepted. */
  status: 'queued';
  /** Full raw Daraja response. */
  raw: Record<string, unknown>;
}

// ── Status ──────────────────────────────────────────────────────────────

export interface StatusOptions {
  /** M-Pesa transaction ID. */
  transactionId: string;
  /** URL where Daraja sends the result. */
  callbackUrl: string;
  /** URL for timeout notifications. Defaults to callbackUrl. */
  timeoutUrl?: string;
}

export interface StatusResult {
  /** ConversationID for this query. */
  conversationId: string;
  /** OriginatorConversationID. */
  originatorConversationId: string;
  /** Query is always async. */
  status: 'queued';
  /** Full raw Daraja response. */
  raw: Record<string, unknown>;
}

// ── Balance ─────────────────────────────────────────────────────────────

export interface BalanceOptions {
  /** URL where Daraja sends the result. */
  callbackUrl: string;
  /** URL for timeout notifications. Defaults to callbackUrl. */
  timeoutUrl?: string;
}

export interface BalanceResult {
  /** ConversationID for this query. */
  conversationId: string;
  /** OriginatorConversationID. */
  originatorConversationId: string;
  /** Query is always async. */
  status: 'queued';
  /** Full raw Daraja response. */
  raw: Record<string, unknown>;
}

// ── Reverse ─────────────────────────────────────────────────────────────

export interface ReverseOptions {
  /** M-Pesa transaction ID to reverse. */
  transactionId: string;
  /** Amount to reverse. */
  amount: number;
  /** URL where Daraja sends the result. */
  callbackUrl: string;
  /** URL for timeout notifications. Defaults to callbackUrl. */
  timeoutUrl?: string;
}

export interface ReverseResult {
  /** ConversationID for this reversal. */
  conversationId: string;
  /** OriginatorConversationID. */
  originatorConversationId: string;
  /** Reversal is always async. */
  status: 'queued';
  /** Full raw Daraja response. */
  raw: Record<string, unknown>;
}

// ── QR ──────────────────────────────────────────────────────────────────

export interface QrOptions {
  /** Amount in KES. */
  amount: number;
  /** Merchant or business name. Default: shortcode. */
  merchantName?: string;
  /** Reference/invoice number. Default: "Payment". */
  reference?: string;
  /** Transaction type. Default: 'paybill'. */
  type?: 'paybill' | 'buygoods' | 'send_money' | 'withdraw' | 'send_to_business';
  /** QR image size in pixels. Default: 300. */
  size?: number;
}

export interface QrResult {
  /** Base64-encoded QR code PNG image. */
  qrCode: string;
  /** Full raw Daraja response. */
  raw: Record<string, unknown>;
}
