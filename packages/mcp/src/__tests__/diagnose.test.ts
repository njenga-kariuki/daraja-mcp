import { describe, it, expect } from 'vitest';
import { handleDiagnose } from '../tools/diagnose.js';

const ALL_ERROR_CODES = [
  '1', '03', '04', '05', '08', '10', '11', '12', '29', '35', '36', '41', '42', '99',
  '1001', '1025', '1032', '1037', '2001', '9999',
];

describe('handleDiagnose — all error codes return structured diagnosis', () => {
  for (const code of ALL_ERROR_CODES) {
    it(`diagnoses error code ${code} with meaning, fix, and prevention`, () => {
      const result = handleDiagnose({ error: code });

      expect(result.errorCode).toBe(code);
      expect(result.meaning).not.toBe('Unrecognized error');
      expect(result.meaning.length).toBeGreaterThan(3);
      expect(result.rootCause.length).toBeGreaterThan(10);
      expect(result.fix.length).toBeGreaterThan(10);

      // Prevention field must exist for all known codes
      expect(result.prevention).toBeTruthy();
      expect(result.prevention!.length).toBeGreaterThan(10);

      // Prevention must be distinct from the fix
      expect(result.prevention).not.toBe(result.fix);
    });
  }
});

describe('handleDiagnose — pattern matching for HTTP/context errors', () => {
  it('diagnoses 401 auth errors from text', () => {
    const result = handleDiagnose({ error: 'Got 401 Unauthorized' });
    expect(result.errorCode).toBe('401/403');
    expect(result.meaning).toContain('Authentication');
  });

  it('diagnoses callback issues from text', () => {
    const result = handleDiagnose({ error: 'callback timeout' });
    expect(result.errorCode).toBe('CALLBACK');
    expect(result.meaning).toContain('Callback');
  });

  it('diagnoses security credential issues from text', () => {
    const result = handleDiagnose({ error: 'SecurityCredential invalid' });
    expect(result.errorCode).toBe('SECURITY_CREDENTIAL');
  });

  it('returns UNKNOWN for completely unrecognized errors', () => {
    const result = handleDiagnose({ error: 'some totally random error with no numbers' });
    expect(result.errorCode).toBe('UNKNOWN');
  });
});

describe('handleDiagnose — error code extraction from complex strings', () => {
  it('extracts error code from JSON-like string', () => {
    const result = handleDiagnose({ error: '{"ResultCode": "35", "ResultDesc": "duplicate"}' });
    expect(result.errorCode).toBe('35');
    expect(result.meaning).toContain('Duplicate');
  });

  it('extracts error code from error message', () => {
    const result = handleDiagnose({ error: 'Daraja returned error 1032' });
    expect(result.errorCode).toBe('1032');
    expect(result.meaning).toContain('cancelled');
  });
});
