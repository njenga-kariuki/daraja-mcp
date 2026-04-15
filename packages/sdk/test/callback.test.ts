import { describe, it, expect, beforeEach } from 'vitest';
import { verifyCallback } from '../src/callback.js';

// Reset the internal processedIds map between tests by calling with unique IDs.

describe('verifyCallback — IP verification', () => {
  const validBody = {
    Result: {
      ResultCode: 0,
      ResultDesc: 'Success',
      ConversationID: `test-ip-${Date.now()}`,
      TransactionID: 'TXN001',
    },
  };

  it('accepts requests from Safaricom IPs', () => {
    const result = verifyCallback(validBody, { ip: '196.201.214.200' });
    expect(result.valid).toBe(true);
  });

  it('rejects requests from non-Safaricom IPs', () => {
    const body = { ...validBody, Result: { ...validBody.Result, ConversationID: `test-reject-${Date.now()}` } };
    const result = verifyCallback(body, { ip: '1.2.3.4' });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not in allowed list');
  });

  it('handles IPv6-mapped addresses (::ffff:prefix)', () => {
    const body = { ...validBody, Result: { ...validBody.Result, ConversationID: `test-ipv6-${Date.now()}` } };
    const result = verifyCallback(body, { ip: '::ffff:196.201.214.200' });
    expect(result.valid).toBe(true);
  });

  it('skips IP check when allowedIPs is "any"', () => {
    const body = { ...validBody, Result: { ...validBody.Result, ConversationID: `test-any-${Date.now()}` } };
    const result = verifyCallback(body, { ip: '1.2.3.4', allowedIPs: 'any' });
    expect(result.valid).toBe(true);
  });

  it('skips IP check when no IP provided', () => {
    const body = { ...validBody, Result: { ...validBody.Result, ConversationID: `test-noip-${Date.now()}` } };
    const result = verifyCallback(body, {});
    expect(result.valid).toBe(true);
  });

  it('supports custom allowed IPs', () => {
    const body = { ...validBody, Result: { ...validBody.Result, ConversationID: `test-custom-${Date.now()}` } };
    const result = verifyCallback(body, { ip: '10.0.0.1', allowedIPs: ['10.0.0.1'] });
    expect(result.valid).toBe(true);
  });
});

describe('verifyCallback — payload validation', () => {
  it('parses B2C/Status callback (Result shape)', () => {
    const body = {
      Result: {
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        ConversationID: `b2c-${Date.now()}`,
        TransactionID: 'QKJ41HAY4I',
      },
    };
    const result = verifyCallback(body, { allowedIPs: 'any' });
    expect(result.valid).toBe(true);
    expect(result.data?.resultCode).toBe(0);
    expect(result.data?.transactionId).toBe('QKJ41HAY4I');
  });

  it('parses STK Push callback (Body.stkCallback shape)', () => {
    const body = {
      Body: {
        stkCallback: {
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          MerchantRequestID: 'MR001',
          CheckoutRequestID: `stk-${Date.now()}`,
        },
      },
    };
    const result = verifyCallback(body, { allowedIPs: 'any' });
    expect(result.valid).toBe(true);
    expect(result.data?.resultCode).toBe(0);
  });

  it('rejects unrecognized payload structure', () => {
    const result = verifyCallback({ random: 'data' }, { allowedIPs: 'any' });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Unrecognized');
  });

  it('rejects payload without ResultCode', () => {
    const result = verifyCallback({ Result: { ResultDesc: 'no code' } }, { allowedIPs: 'any' });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('ResultCode');
  });
});

describe('verifyCallback — idempotency', () => {
  it('flags duplicate callbacks by ConversationID', () => {
    const convId = `dedup-${Date.now()}`;
    const body = {
      Result: { ResultCode: 0, ResultDesc: 'OK', ConversationID: convId, TransactionID: 'T1' },
    };

    const first = verifyCallback(body, { allowedIPs: 'any' });
    expect(first.valid).toBe(true);
    expect(first.duplicate).toBe(false);

    const second = verifyCallback(body, { allowedIPs: 'any' });
    expect(second.valid).toBe(true);
    expect(second.duplicate).toBe(true);
  });

  it('allows disabling idempotency with TTL=0', () => {
    const convId = `no-dedup-${Date.now()}`;
    const body = {
      Result: { ResultCode: 0, ResultDesc: 'OK', ConversationID: convId, TransactionID: 'T2' },
    };

    const first = verifyCallback(body, { allowedIPs: 'any', idempotencyTTL: 0 });
    const second = verifyCallback(body, { allowedIPs: 'any', idempotencyTTL: 0 });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(false);
  });
});
