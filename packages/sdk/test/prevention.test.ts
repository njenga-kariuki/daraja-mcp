import { describe, it, expect } from 'vitest';
import { mapDarajaError, mapHttpError, MpesaError } from '../src/errors.js';

describe('MpesaError — .prevention field', () => {
  it('MpesaError supports prevention in constructor', () => {
    const err = new MpesaError({
      message: 'test',
      code: 'TEST',
      suggestion: 'fix it',
      prevention: 'prevent it',
    });
    expect(err.prevention).toBe('prevent it');
  });

  it('prevention is optional (undefined when not provided)', () => {
    const err = new MpesaError({
      message: 'test',
      code: 'TEST',
      suggestion: 'fix it',
    });
    expect(err.prevention).toBeUndefined();
  });
});

describe('mapDarajaError — all codes have prevention', () => {
  const KNOWN_CODES = ['1', '03', '04', '05', '08', '10', '11', '12', '29', '35', '36', '41', '42', '99', '1001', '1025', '1032', '1037', '2001', '9999'];

  for (const code of KNOWN_CODES) {
    it(`error code ${code} has a non-empty prevention string`, () => {
      const err = mapDarajaError(code, 'test');
      expect(err.prevention).toBeTruthy();
      expect(typeof err.prevention).toBe('string');
      expect(err.prevention!.length).toBeGreaterThan(20);
    });
  }

  it('fallback/unknown error code has prevention', () => {
    const err = mapDarajaError('UNKNOWN_CODE', 'something');
    expect(err.prevention).toBeTruthy();
  });
});

describe('mapHttpError — all status codes have prevention', () => {
  const HTTP_CODES = [400, 401, 403, 404, 429, 500, 502, 503];

  for (const status of HTTP_CODES) {
    it(`HTTP ${status} has prevention`, () => {
      const err = mapHttpError(status);
      expect(err.prevention).toBeTruthy();
      expect(typeof err.prevention).toBe('string');
    });
  }
});

describe('prevention content is actionable (not generic)', () => {
  it('DUPLICATE_TRANSACTION prevention mentions deduplication', () => {
    const err = mapDarajaError('35', 'Duplicate');
    expect(err.prevention).toMatch(/dedup|phone\+amount|recent/i);
  });

  it('AMOUNT_TOO_HIGH prevention mentions 150,000 limit', () => {
    const err = mapDarajaError('04', 'Too high');
    expect(err.prevention).toMatch(/150.?000/);
  });

  it('AUTH_FAILED prevention mentions environment variables', () => {
    const err = mapDarajaError('36', 'Wrong creds');
    expect(err.prevention).toMatch(/environment|env/i);
  });

  it('RATE_LIMITED prevention mentions backoff', () => {
    const err = mapHttpError(429);
    expect(err.prevention).toMatch(/backoff|jitter/i);
  });
});
