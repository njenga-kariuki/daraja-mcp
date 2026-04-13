import 'dotenv/config';

const required = (key, fallback) => {
  const v = process.env[key] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required env: ${key}`);
  }
  return v;
};

const env = (process.env.DARAJA_ENV ?? 'sandbox').toLowerCase();

export const config = {
  env,
  baseUrl:
    env === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke',

  consumerKey: required('DARAJA_CONSUMER_KEY'),
  consumerSecret: required('DARAJA_CONSUMER_SECRET'),

  // STK Push
  shortcode: process.env.MPESA_SHORTCODE ?? '174379',
  passkey:
    process.env.MPESA_PASSKEY ??
    'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',

  // B2C / Status / Balance / Reversal
  initiatorName: process.env.MPESA_INITIATOR_NAME ?? 'testapi',
  initiatorPassword: process.env.MPESA_INITIATOR_PASSWORD ?? 'Safaricom999!*!',
  b2cShortcode: process.env.MPESA_B2C_SHORTCODE ?? '600999',
  preEncryptedSecurityCredential:
    process.env.MPESA_B2C_SECURITY_CREDENTIAL ?? '',
  certPath: process.env.MPESA_CERT_PATH ?? './certs/SandboxCertificate.cer',

  // Callbacks
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,

  port: Number(process.env.PORT ?? 3000),
};

export const callbackUrl = (path) => `${config.publicBaseUrl}${path}`;
