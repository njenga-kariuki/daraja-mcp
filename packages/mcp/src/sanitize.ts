/**
 * PII sanitization for MCP tool outputs.
 *
 * Masks sensitive data before it enters the AI agent's context.
 * Phone numbers are personal data under the Kenya Data Protection Act —
 * they should not flow through agent memory or third-party APIs.
 */

/** Matches Kenyan phone numbers in 254XXXXXXXXX format (12 digits). */
const PHONE_REGEX = /\b(254\d{3})\d{3}(\d{3})\b/g;

/** Matches consumer keys/secrets (long alphanumeric strings in common config patterns). */
const CREDENTIAL_REGEX = /(?:consumer[_-]?(?:key|secret)|password)\s*[:=]\s*['"]([A-Za-z0-9]{20,})['"]/gi;

/**
 * Mask phone numbers and credentials in a string.
 *
 * - Phone: 254708374149 → 254708***149
 * - Credentials: consumerKey: "abc123..." → consumerKey: "***"
 */
export function sanitizeText(text: string): string {
  return text
    .replace(PHONE_REGEX, '$1***$2')
    .replace(CREDENTIAL_REGEX, (match, _cred) => match.replace(_cred, '***'));
}

/**
 * Recursively sanitize PII in any JSON-serializable value.
 * Walks objects and arrays, applies sanitizeText to all string values.
 */
export function sanitize(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeText(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = sanitize(v);
    }
    return result;
  }
  return value;
}
