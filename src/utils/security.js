import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

/**
 * Daraja requires the Initiator password to be RSA-encrypted with Safaricom's
 * public certificate (sandbox or production). The encrypted blob is sent as
 * `SecurityCredential` in B2C / Transaction Status / Account Balance / Reversal.
 *
 * Download:
 *   Sandbox: https://developer.safaricom.co.ke/Documentation (SandboxCertificate.cer)
 *   Production: ProductionCertificate.cer
 *
 * Place the .cer file at the path specified by MPESA_CERT_PATH.
 */
export function buildSecurityCredential() {
  // Allow a pre-computed value to be injected directly.
  if (config.preEncryptedSecurityCredential) {
    return config.preEncryptedSecurityCredential;
  }

  const certPath = path.resolve(process.cwd(), config.certPath);
  if (!fs.existsSync(certPath)) {
    throw new Error(
      `Daraja cert not found at ${certPath}. Download SandboxCertificate.cer ` +
        `from developer.safaricom.co.ke and place it there, or set ` +
        `MPESA_B2C_SECURITY_CREDENTIAL directly.`,
    );
  }

  const cert = fs.readFileSync(certPath);
  const encrypted = crypto.publicEncrypt(
    {
      key: cert,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(config.initiatorPassword, 'utf8'),
  );
  return encrypted.toString('base64');
}

/**
 * Timestamp in Daraja's expected format: YYYYMMDDHHmmss (no separators).
 */
export function darajaTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

/**
 * Lipa Na M-Pesa Online password: base64(shortcode + passkey + timestamp).
 */
export function stkPushPassword(shortcode, passkey, timestamp) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

/**
 * Normalize a phone number to Daraja's expected 2547XXXXXXXX / 2541XXXXXXXX format.
 */
export function normalizeMsisdn(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.startsWith('7') || digits.startsWith('1')) return '254' + digits;
  return digits;
}
