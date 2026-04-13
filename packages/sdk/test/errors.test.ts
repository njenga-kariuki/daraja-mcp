import { describe, it, expect } from 'vitest';
import {
  MpesaError,
  AuthError,
  ValidationError,
  TimeoutError,
  InsufficientFundsError,
  mapDarajaError,
  mapHttpError,
} from '../src/errors.js';

describe('error hierarchy', () => {
  it('MpesaError has code, suggestion, and optional fields', () => {
    const err = new MpesaError({
      message: 'test',
      code: 'TEST',
      suggestion: 'do something',
      darajaCode: '99',
      httpStatus: 400,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('TEST');
    expect(err.suggestion).toBe('do something');
    expect(err.darajaCode).toBe('99');
  });

  it('subclasses are instances of MpesaError', () => {
    const auth = new AuthError({ message: 'auth', suggestion: 'fix auth' });
    expect(auth).toBeInstanceOf(MpesaError);
    expect(auth.code).toBe('AUTH_FAILED');

    const val = new ValidationError({ message: 'val', suggestion: 'fix val' });
    expect(val).toBeInstanceOf(MpesaError);

    const timeout = new TimeoutError({ message: 't', suggestion: 'retry' });
    expect(timeout).toBeInstanceOf(MpesaError);
    expect(timeout.code).toBe('TIMEOUT');

    const funds = new InsufficientFundsError({ message: 'f', suggestion: 'top up' });
    expect(funds).toBeInstanceOf(MpesaError);
    expect(funds.code).toBe('INSUFFICIENT_FUNDS');
  });
});

describe('mapDarajaError', () => {
  it('maps code 1 to InsufficientFundsError', () => {
    const err = mapDarajaError('1', 'Insufficient balance');
    expect(err).toBeInstanceOf(InsufficientFundsError);
    expect(err.darajaCode).toBe('1');
  });

  it('maps code 1032 to USER_CANCELLED', () => {
    const err = mapDarajaError('1032', 'Request cancelled by user');
    expect(err.code).toBe('USER_CANCELLED');
    expect(err.suggestion).toContain('cancelled');
  });

  it('maps code 1037 to TimeoutError', () => {
    const err = mapDarajaError('1037', 'MSISDN unreachable');
    expect(err).toBeInstanceOf(TimeoutError);
  });

  it('returns generic MpesaError for unknown codes', () => {
    const err = mapDarajaError('9876', 'Something weird');
    expect(err).toBeInstanceOf(MpesaError);
    expect(err.code).toBe('DARAJA_ERROR');
  });
});

describe('mapHttpError', () => {
  it('maps 401 to AuthError', () => {
    const err = mapHttpError(401);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.suggestion).toContain('consumer key');
  });

  it('maps 400 to ValidationError', () => {
    const err = mapHttpError(400, { errorMessage: 'Bad Request' });
    expect(err).toBeInstanceOf(ValidationError);
  });

  it('maps 429 to RATE_LIMITED', () => {
    const err = mapHttpError(429);
    expect(err.code).toBe('RATE_LIMITED');
  });

  it('maps 500+ to SERVER_ERROR', () => {
    const err = mapHttpError(503);
    expect(err.code).toBe('SERVER_ERROR');
  });
});
