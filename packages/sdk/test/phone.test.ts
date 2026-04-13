import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../src/phone.js';

describe('normalizePhone', () => {
  it('passes through 254 format', () => {
    expect(normalizePhone('254712345678')).toBe('254712345678');
  });

  it('converts 0-prefix to 254', () => {
    expect(normalizePhone('0712345678')).toBe('254712345678');
  });

  it('converts 7-prefix to 254', () => {
    expect(normalizePhone('712345678')).toBe('254712345678');
  });

  it('converts 1-prefix (Safaricom new range) to 254', () => {
    expect(normalizePhone('0112345678')).toBe('254112345678');
    expect(normalizePhone('112345678')).toBe('254112345678');
  });

  it('strips non-digit chars (+, spaces, dashes)', () => {
    expect(normalizePhone('+254 712 345 678')).toBe('254712345678');
    expect(normalizePhone('+254-712-345-678')).toBe('254712345678');
  });

  it('throws ValidationError for invalid numbers', () => {
    expect(() => normalizePhone('')).toThrow('Invalid phone');
    expect(() => normalizePhone('12345')).toThrow('Invalid phone');
    expect(() => normalizePhone('abcdefghij')).toThrow('Invalid phone');
  });
});
