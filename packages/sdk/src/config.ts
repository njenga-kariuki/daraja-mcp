import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SANDBOX, PRODUCTION } from './constants.js';
import { AuthError } from './errors.js';
import type { MpesaConfig, ResolvedConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Path to the bundled sandbox certificate (shipped with the SDK). */
const BUNDLED_SANDBOX_CERT = path.resolve(__dirname, '..', 'certs', 'sandbox.cer');

/**
 * Resolve config with this priority: explicit options > env vars > sandbox defaults.
 * Only consumerKey + consumerSecret are required — everything else has sandbox defaults.
 */
export function resolveConfig(opts: MpesaConfig = {}): ResolvedConfig {
  const env = opts.env ?? (process.env.DARAJA_ENV as 'sandbox' | 'production') ?? 'sandbox';
  const isSandbox = env === 'sandbox';

  const consumerKey =
    opts.consumerKey ?? process.env.DARAJA_CONSUMER_KEY ?? '';
  const consumerSecret =
    opts.consumerSecret ?? process.env.DARAJA_CONSUMER_SECRET ?? '';

  if (!consumerKey || !consumerSecret) {
    throw new AuthError({
      message: 'Missing Daraja consumer key and/or secret',
      suggestion:
        'Create a free Daraja app at developer.safaricom.co.ke (takes 2 minutes):\n' +
        '1. Sign up or log in\n' +
        '2. Go to My Apps → Add a New App\n' +
        '3. Copy your Consumer Key and Consumer Secret\n' +
        '4. Set them as DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET environment variables,\n' +
        '   or pass them to createClient({ consumerKey, consumerSecret })',
    });
  }

  return {
    env,
    baseUrl: isSandbox ? SANDBOX.baseUrl : PRODUCTION.baseUrl,
    consumerKey,
    consumerSecret,
    shortcode: opts.shortcode ?? process.env.MPESA_SHORTCODE ?? (isSandbox ? SANDBOX.shortcode : ''),
    passkey: opts.passkey ?? process.env.MPESA_PASSKEY ?? (isSandbox ? SANDBOX.passkey : ''),
    initiatorName:
      opts.initiatorName ?? process.env.MPESA_INITIATOR_NAME ?? (isSandbox ? SANDBOX.initiatorName : ''),
    initiatorPassword:
      opts.initiatorPassword ??
      process.env.MPESA_INITIATOR_PASSWORD ??
      (isSandbox ? SANDBOX.initiatorPassword : ''),
    b2cShortcode:
      opts.b2cShortcode ?? process.env.MPESA_B2C_SHORTCODE ?? (isSandbox ? SANDBOX.b2cShortcode : ''),
    certPath: opts.certPath ?? process.env.MPESA_CERT_PATH ?? (isSandbox ? BUNDLED_SANDBOX_CERT : ''),
    securityCredential: opts.securityCredential ?? process.env.MPESA_SECURITY_CREDENTIAL ?? undefined,
    callbackBaseUrl: opts.callbackBaseUrl ?? process.env.MPESA_CALLBACK_BASE_URL ?? undefined,
    timeout: opts.timeout ?? 30_000,
  };
}
