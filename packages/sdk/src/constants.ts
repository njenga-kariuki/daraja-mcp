/** Daraja CommandID values mapped to human-friendly names. */
export const CommandID = {
  // B2C
  SalaryPayment: 'SalaryPayment',
  BusinessPayment: 'BusinessPayment',
  PromotionPayment: 'PromotionPayment',
  // C2B
  CustomerPayBillOnline: 'CustomerPayBillOnline',
  CustomerBuyGoodsOnline: 'CustomerBuyGoodsOnline',
  // Queries
  TransactionStatusQuery: 'TransactionStatusQuery',
  AccountBalance: 'AccountBalance',
  TransactionReversal: 'TransactionReversal',
} as const;

/** Maps our send() type param to Daraja CommandID. */
export const SEND_TYPE_MAP: Record<string, string> = {
  salary: CommandID.SalaryPayment,
  business: CommandID.BusinessPayment,
  promotion: CommandID.PromotionPayment,
};

/** Daraja identifier types. */
export const IdentifierType = {
  MSISDN: '1',
  TillNumber: '2',
  Shortcode: '4',
} as const;

/** Maps QR type param to Daraja TrxCode. */
export const QR_TYPE_MAP: Record<string, string> = {
  buygoods: 'BG',
  withdraw: 'WA',
  paybill: 'PB',
  send_money: 'SM',
  send_to_business: 'SB',
};

/** Well-known sandbox credentials (public — not secrets). */
export const SANDBOX = {
  baseUrl: 'https://sandbox.safaricom.co.ke',
  shortcode: '174379',
  passkey: 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
  /** Shared sandbox consumer key — daraja-kit community app. */
  consumerKey: 'aFPNikDVDCxaOgkW2hXjo6VEXnOgVCludG5UGpowlEU8AsIm',
  /** Shared sandbox consumer secret — daraja-kit community app. */
  consumerSecret: 'o0MVh9tfjEH85lkGIx5bhH1sMvrj3tpio9AJNlrzJPXmpGLI57UbHH8eLaUdCX8G',
  initiatorName: 'testapi',
  initiatorPassword: 'Safaricom999!*!',
  b2cShortcode: '600999',
  testPhone: '254708374149',
} as const;

export const PRODUCTION = {
  baseUrl: 'https://api.safaricom.co.ke',
} as const;
