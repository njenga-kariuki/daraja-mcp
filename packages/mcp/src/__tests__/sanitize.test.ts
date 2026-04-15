import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitize } from '../sanitize.js';

describe('sanitizeText — phone number masking', () => {
  it('masks 254XXXXXXXXX phone numbers', () => {
    expect(sanitizeText('Phone: 254708374149')).toBe('Phone: 254708***149');
  });

  it('masks multiple phone numbers in one string', () => {
    const input = 'From 254708374149 to 254712345678';
    const output = sanitizeText(input);
    expect(output).toBe('From 254708***149 to 254712***678');
  });

  it('does not mask non-phone 12-digit numbers', () => {
    // Only matches numbers starting with 254 followed by 9 digits
    expect(sanitizeText('Order ID: 123456789012')).toBe('Order ID: 123456789012');
  });

  it('preserves text without phone numbers', () => {
    const text = 'Payment successful, amount KES 1000';
    expect(sanitizeText(text)).toBe(text);
  });
});

describe('sanitizeText — credential masking', () => {
  it('masks consumer key patterns', () => {
    const input = 'consumerKey: "aFPNikDVDCxaOgkW2hXjo6VEXnOgVCludG5UGpowlEU8AsIm"';
    expect(sanitizeText(input)).toContain('***');
    expect(sanitizeText(input)).not.toContain('aFPNikDVDCx');
  });

  it('masks consumer_secret patterns', () => {
    const input = "consumer_secret = 'o0MVh9tfjEH85lkGIx5bhH1sMvrj3tpio9AJNlrzJPXmpGLI57UbHH8eLaUdCX8G'";
    expect(sanitizeText(input)).toContain('***');
  });
});

describe('sanitize — deep object sanitization', () => {
  it('sanitizes strings in nested objects', () => {
    const obj = {
      phone: '254708374149',
      nested: { recipient: '254712345678' },
    };
    const result = sanitize(obj) as any;
    expect(result.phone).toBe('254708***149');
    expect(result.nested.recipient).toBe('254712***678');
  });

  it('sanitizes strings in arrays', () => {
    const arr = ['254708374149', 'no phone here'];
    const result = sanitize(arr) as string[];
    expect(result[0]).toBe('254708***149');
    expect(result[1]).toBe('no phone here');
  });

  it('passes through non-string primitives', () => {
    expect(sanitize(42)).toBe(42);
    expect(sanitize(true)).toBe(true);
    expect(sanitize(null)).toBe(null);
  });
});
