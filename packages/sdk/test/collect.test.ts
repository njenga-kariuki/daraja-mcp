import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collect } from '../src/methods/collect.js';
import type { ResolvedConfig } from '../src/types.js';
import { SANDBOX } from '../src/constants.js';

const mockConfig: ResolvedConfig = {
  env: 'sandbox',
  baseUrl: SANDBOX.baseUrl,
  consumerKey: 'test-key',
  consumerSecret: 'test-secret',
  shortcode: SANDBOX.shortcode,
  passkey: SANDBOX.passkey,
  initiatorName: SANDBOX.initiatorName,
  initiatorPassword: SANDBOX.initiatorPassword,
  b2cShortcode: SANDBOX.b2cShortcode,
  certPath: '',
  timeout: 30_000,
};

function mockHttp(response: Record<string, unknown>) {
  return {
    post: vi.fn().mockResolvedValue({ data: response }),
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  } as any;
}

describe('collect (STK Push)', () => {
  it('throws ValidationError for missing phone', async () => {
    const http = mockHttp({});
    await expect(collect(http, mockConfig, { amount: 100, phone: '' })).rejects.toThrow('Phone number is required');
  });

  it('throws ValidationError for invalid amount', async () => {
    const http = mockHttp({});
    await expect(collect(http, mockConfig, { amount: 0, phone: '0712345678' })).rejects.toThrow('Invalid amount');
    await expect(collect(http, mockConfig, { amount: 1.5, phone: '0712345678' })).rejects.toThrow('Invalid amount');
  });

  it('returns pending result when poll is disabled', async () => {
    const http = mockHttp({
      MerchantRequestID: 'merch-123',
      CheckoutRequestID: 'checkout-123',
      ResponseCode: '0',
      ResponseDescription: 'Success. Request accepted for processing',
    });

    const result = await collect(http, mockConfig, {
      amount: 100,
      phone: '0712345678',
      poll: false,
    });

    expect(result.id).toBe('checkout-123');
    expect(result.status).toBe('pending');
    expect(result.phone).toBe('254712345678');
    expect(http.post).toHaveBeenCalledWith(
      '/mpesa/stkpush/v1/processrequest',
      expect.objectContaining({
        BusinessShortCode: '174379',
        Amount: '100',
        PhoneNumber: '254712345678',
      }),
    );
  });

  it('truncates reference to 12 chars and description to 13', async () => {
    const http = mockHttp({
      MerchantRequestID: 'merch-123',
      CheckoutRequestID: 'checkout-123',
    });

    await collect(http, mockConfig, {
      amount: 1,
      phone: '0712345678',
      reference: 'ABCDEFGHIJKLMNOP', // 16 chars
      description: 'This is a very long description', // 30 chars
      poll: false,
    });

    const payload = http.post.mock.calls[0][1];
    expect(payload.AccountReference).toBe('ABCDEFGHIJKL'); // 12
    expect(payload.TransactionDesc).toBe('This is a ver'); // 13
  });
});
