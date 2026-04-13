import { describe, it, expect, vi } from 'vitest';
import { send } from '../src/methods/send.js';
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
  securityCredential: 'pre-encrypted-credential',
  timeout: 30_000,
};

function mockHttp(response: Record<string, unknown>) {
  return {
    post: vi.fn().mockResolvedValue({ data: response }),
  } as any;
}

describe('send (B2C)', () => {
  it('throws for missing callbackUrl', async () => {
    const http = mockHttp({});
    await expect(
      send(http, mockConfig, { amount: 100, phone: '0712345678', callbackUrl: '' }),
    ).rejects.toThrow('callbackUrl is required');
  });

  it('throws for missing phone', async () => {
    const http = mockHttp({});
    await expect(
      send(http, mockConfig, { amount: 100, phone: '', callbackUrl: 'https://example.com' }),
    ).rejects.toThrow('Phone number is required');
  });

  it('maps type to correct CommandID', async () => {
    const http = mockHttp({
      ConversationID: 'conv-1',
      OriginatorConversationID: 'orig-1',
    });

    await send(http, mockConfig, {
      amount: 100,
      phone: '0712345678',
      type: 'salary',
      callbackUrl: 'https://example.com/cb',
    });

    expect(http.post).toHaveBeenCalledWith(
      '/mpesa/b2c/v1/paymentrequest',
      expect.objectContaining({
        CommandID: 'SalaryPayment',
        Amount: '100',
        PartyB: '254712345678',
        SecurityCredential: 'pre-encrypted-credential',
      }),
    );
  });

  it('returns queued result', async () => {
    const http = mockHttp({
      ConversationID: 'conv-1',
      OriginatorConversationID: 'orig-1',
      ResponseDescription: 'Accept the service request successfully.',
    });

    const result = await send(http, mockConfig, {
      amount: 500,
      phone: '0712345678',
      callbackUrl: 'https://example.com/cb',
    });

    expect(result.status).toBe('queued');
    expect(result.conversationId).toBe('conv-1');
  });
});
