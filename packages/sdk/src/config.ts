import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SANDBOX, PRODUCTION } from './constants.js';
import { AuthError } from './errors.js';
import type { MpesaConfig, ResolvedConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Fallback location inside the SDK package for users who prefer a repo-local
 * drop. Not populated by default — see sandbox cert discovery below.
 */
const PACKAGE_LOCAL_CERT = path.resolve(__dirname, '..', 'certs', 'sandbox.cer');

/**
 * Discover the sandbox certificate. Daraja's B2C-family methods RSA-encrypt
 * the initiator password with Safaricom's public cert; the cert is downloadable
 * from developer.safaricom.co.ke but not bundled with this SDK.
 *
 * Resolution order (first path that exists wins):
 *   1. ~/.daraja/sandbox.cer          — canonical per-user location
 *   2. ./certs/sandbox.cer            — repo-local drop (relative to cwd)
 *   3. packages/sdk/certs/sandbox.cer — package-local drop (for monorepo dev)
 *
 * If none exist, returns the canonical path so the downstream error points
 * users at the right place to put the file.
 */
function discoverSandboxCert(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE;
  const canonical = home ? path.join(home, '.daraja', 'sandbox.cer') : PACKAGE_LOCAL_CERT;
  const candidates = [canonical, path.resolve(process.cwd(), 'certs', 'sandbox.cer'), PACKAGE_LOCAL_CERT];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // Ignore permission errors and keep trying.
    }
  }
  return canonical;
}

/**
 * Resolve config with this priority: explicit options > env vars > sandbox defaults.
 * Only consumerKey + consumerSecret are required — everything else has sandbox defaults.
 */
export function resolveConfig(opts: MpesaConfig = {}): ResolvedConfig {
  const env = opts.env ?? (process.env.DARAJA_ENV as 'sandbox' | 'production') ?? 'sandbox';
  const isSandbox = env === 'sandbox';

  let consumerKey =
    opts.consumerKey ?? process.env.DARAJA_CONSUMER_KEY ?? '';
  let consumerSecret =
    opts.consumerSecret ?? process.env.DARAJA_CONSUMER_SECRET ?? '';

  if (!consumerKey || !consumerSecret) {
    if (isSandbox) {
      // Zero-config sandbox: fall back to shared daraja-kit community credentials.
      // These are sandbox-only — no real money, same class as the public passkey/shortcode.
      consumerKey = SANDBOX.consumerKey;
      consumerSecret = SANDBOX.consumerSecret;
    } else {
      throw new AuthError({
        message: 'Missing Daraja credentials for production',
        suggestion:
          'Production requires your own credentials. Get them free at developer.safaricom.co.ke:\n' +
          '1. Sign up or log in\n' +
          '2. Go to My Apps → Add a New App\n' +
          '3. Copy your Consumer Key and Consumer Secret\n' +
          '4. Set them as DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET environment variables,\n' +
          '   or pass them to createClient({ consumerKey, consumerSecret })',
      });
    }
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
    certPath: opts.certPath ?? process.env.MPESA_CERT_PATH ?? (isSandbox ? discoverSandboxCert() : ''),
    securityCredential: opts.securityCredential ?? process.env.MPESA_SECURITY_CREDENTIAL ?? undefined,
    callbackBaseUrl: opts.callbackBaseUrl ?? process.env.MPESA_CALLBACK_BASE_URL ?? undefined,
    timeout: opts.timeout ?? 30_000,
  };
}
