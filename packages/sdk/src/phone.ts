import { ValidationError } from './errors.js';

/**
 * Normalize any Kenyan phone number to Daraja's 254XXXXXXXXX format.
 *
 * Accepts:  0712345678, +254712345678, 254712345678, 712345678, 0112345678
 * Returns:  254712345678
 * Throws:   ValidationError for invalid numbers
 */
export function normalizePhone(raw: string): string {
  const digits = String(raw).replace(/\D/g, '');

  let normalized: string;
  if (digits.startsWith('254') && (digits.length === 12)) {
    normalized = digits;
  } else if (digits.startsWith('0') && digits.length === 10) {
    normalized = '254' + digits.slice(1);
  } else if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    normalized = '254' + digits;
  } else {
    throw new ValidationError({
      message: `Invalid phone number: "${raw}"`,
      code: 'INVALID_PHONE',
      suggestion:
        'Phone number must be a valid Kenyan number. Accepted formats: 0712345678, +254712345678, 254712345678, or 712345678.',
    });
  }

  return normalized;
}
