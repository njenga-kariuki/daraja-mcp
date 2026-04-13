import { describe, it, expect } from 'vitest';
import { darajaTimestamp, stkPassword } from '../src/security.js';

describe('darajaTimestamp', () => {
  it('formats date as YYYYMMDDHHmmss', () => {
    const date = new Date('2024-03-15T09:05:03');
    expect(darajaTimestamp(date)).toBe('20240315090503');
  });

  it('zero-pads single-digit values', () => {
    const date = new Date('2024-01-01T01:01:01');
    expect(darajaTimestamp(date)).toBe('20240101010101');
  });
});

describe('stkPassword', () => {
  it('produces base64(shortcode + passkey + timestamp)', () => {
    const result = stkPassword('174379', 'abc123', '20240315090503');
    const expected = Buffer.from('174379abc12320240315090503').toString('base64');
    expect(result).toBe(expected);
  });
});
