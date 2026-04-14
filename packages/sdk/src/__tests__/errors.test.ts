import { describe, it, expect } from 'vitest';
import { mapDarajaError } from '../errors.js';

const NEW_ERROR_CODES = ['03', '04', '05', '08', '10', '11', '12', '29', '35', '36', '41', '42', '99'];
const EXISTING_ERROR_CODES = ['1', '1001', '1025', '1032', '1037', '2001', '9999'];

describe('mapDarajaError — new error code mappings', () => {
  for (const code of NEW_ERROR_CODES) {
    it(`maps error code ${code} to a specific error (not generic fallback)`, () => {
      const error = mapDarajaError(code, 'test description');

      // Must NOT fall through to the generic 'DARAJA_ERROR' code
      expect(error.code).not.toBe('DARAJA_ERROR');

      // Must have a meaningful suggestion
      expect(error.suggestion).toBeTruthy();
      expect(error.suggestion.length).toBeGreaterThan(10);

      // Must NOT contain the generic fallback text
      expect(error.suggestion).not.toContain('Check the error-codes reference');

      // Must preserve the original Daraja code
      expect(error.darajaCode).toBe(code);
    });
  }
});

describe('mapDarajaError — existing error codes still work (regression)', () => {
  for (const code of EXISTING_ERROR_CODES) {
    it(`still maps error code ${code} correctly`, () => {
      const error = mapDarajaError(code, 'test description');
      expect(error.code).not.toBe('DARAJA_ERROR');
      expect(error.suggestion).toBeTruthy();
      expect(error.darajaCode).toBe(code);
    });
  }
});

describe('mapDarajaError — specific error types', () => {
  it('returns InsufficientFundsError for code 1', () => {
    const error = mapDarajaError('1', 'test');
    expect(error.name).toBe('InsufficientFundsError');
  });

  it('returns ValidationError for code 03 (amount too low)', () => {
    const error = mapDarajaError('03', 'test');
    expect(error.name).toBe('ValidationError');
    expect(error.code).toBe('AMOUNT_TOO_LOW');
  });

  it('returns ValidationError for code 04 (amount too high)', () => {
    const error = mapDarajaError('04', 'test');
    expect(error.name).toBe('ValidationError');
    expect(error.code).toBe('AMOUNT_TOO_HIGH');
  });

  it('returns TimeoutError for code 05', () => {
    const error = mapDarajaError('05', 'test');
    expect(error.name).toBe('TimeoutError');
  });

  it('returns MpesaError with DUPLICATE_TRANSACTION for code 35', () => {
    const error = mapDarajaError('35', 'test');
    expect(error.code).toBe('DUPLICATE_TRANSACTION');
    expect(error.suggestion).toContain('30 seconds');
  });

  it('returns ValidationError for code 41 (invalid MSISDN)', () => {
    const error = mapDarajaError('41', 'test');
    expect(error.code).toBe('INVALID_MSISDN');
  });

  it('returns MpesaError with TRANSACTION_NOT_FOUND for code 99', () => {
    const error = mapDarajaError('99', 'test');
    expect(error.code).toBe('TRANSACTION_NOT_FOUND');
  });

  it('returns generic DARAJA_ERROR for truly unknown codes', () => {
    const error = mapDarajaError('77777', 'test');
    expect(error.code).toBe('DARAJA_ERROR');
  });
});
