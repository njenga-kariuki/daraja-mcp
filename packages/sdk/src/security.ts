import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MpesaError } from './errors.js';

/**
 * Generate the Daraja timestamp: YYYYMMDDHHmmss (no separators).
 */
export function darajaTimestamp(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    String(date.getFullYear()) +
    p(date.getMonth() + 1) +
    p(date.getDate()) +
    p(date.getHours()) +
    p(date.getMinutes()) +
    p(date.getSeconds())
  );
}

/**
 * Lipa Na M-Pesa Online password: base64(shortcode + passkey + timestamp).
 */
export function stkPassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

/**
 * Build the SecurityCredential for B2C / Status / Balance / Reversal.
 *
 * RSA-encrypts the initiator password with Safaricom's public certificate,
 * then base64-encodes the result.
 *
 * @param password - Initiator password (plain text)
 * @param certPath - Path to Safaricom's .cer file
 * @returns Base64-encoded encrypted credential
 */
export function buildSecurityCredential(password: string, certPath: string): string {
  const resolved = path.resolve(certPath);
  if (!fs.existsSync(resolved)) {
    throw new MpesaError({
      message: `Safaricom certificate not found at ${resolved}`,
      code: 'CERT_NOT_FOUND',
      suggestion:
        'B2C / Status / Balance / Reversal need an RSA-encrypted SecurityCredential. STK Push (collect) and QR do not. Two ways to unblock: ' +
        'OPTION A (simpler — no cert needed): go to developer.safaricom.co.ke → Test Credentials, enter initiator password (Safaricom999!*! for sandbox), select Sandbox, click Generate Password, copy the value, and export MPESA_SECURITY_CREDENTIAL=<value>. ' +
        `OPTION B (cert-based): save the Safaricom sandbox cert at ~/.daraja/sandbox.cer (SDK auto-discovers), or set MPESA_CERT_PATH=/full/path/to/cert.cer.`,
      prevention:
        'For sandbox, MPESA_SECURITY_CREDENTIAL is the low-ceremony path: generate once via the portal, paste into .env, done. For production, prefer MPESA_CERT_PATH with the cert at a stable per-user path so rotations don\'t require re-generation.',
    });
  }

  const cert = fs.readFileSync(resolved);
  const encrypted = crypto.publicEncrypt(
    { key: cert, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(password, 'utf8'),
  );
  return encrypted.toString('base64');
}
