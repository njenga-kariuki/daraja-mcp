import { createClient } from '@daraja-kit/sdk';

interface TestSandboxInput {
  test: 'auth' | 'stk_push' | 'stk_push_query' | 'b2c' | 'balance' | 'qr';
  params?: Record<string, unknown>;
}

interface TestSandboxOutput {
  success: boolean;
  response: Record<string, unknown>;
  duration_ms: number;
  next_steps?: string;
}

export const testSandboxSchema = {
  name: 'daraja_test_sandbox',
  description:
    'Run a real test against the Daraja sandbox to verify integration works. ' +
    'Requires DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET environment variables.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      test: {
        type: 'string',
        enum: ['auth', 'stk_push', 'stk_push_query', 'b2c', 'balance', 'qr'],
        description: 'Which API to test.',
      },
      params: {
        type: 'object',
        description: 'Optional parameters (e.g., { phone: "254708374149", amount: 1 }).',
      },
    },
    required: ['test'],
  },
};

export async function handleTestSandbox(input: TestSandboxInput): Promise<TestSandboxOutput> {
  const start = Date.now();

  try {
    const mpesa = createClient();
    const phone = (input.params?.phone as string) ?? '254708374149';
    const amount = Number(input.params?.amount ?? 1);

    switch (input.test) {
      case 'auth': {
        // Just creating the client validates the OAuth flow on first use.
        // Force a collect with poll:false to trigger auth.
        const result = await mpesa.collect({ amount: 1, phone, poll: false });
        return {
          success: true,
          response: result.raw,
          duration_ms: Date.now() - start,
          next_steps: 'OAuth token acquired successfully. You can now use any M-Pesa API.',
        };
      }

      case 'stk_push': {
        const result = await mpesa.collect({ amount, phone, poll: false });
        return {
          success: true,
          response: result.raw,
          duration_ms: Date.now() - start,
          next_steps:
            `STK Push initiated. CheckoutRequestID: ${result.id}. ` +
            'In sandbox, no actual phone prompt is sent. Use stk_push_query to check status.',
        };
      }

      case 'qr': {
        const result = await mpesa.qr({ amount });
        return {
          success: true,
          response: result.raw,
          duration_ms: Date.now() - start,
          next_steps: 'QR code generated. The base64 PNG is in the response.',
        };
      }

      default:
        return {
          success: false,
          response: { error: `Test "${input.test}" requires callback URLs. Use 'auth', 'stk_push', or 'qr' for callback-free testing.` },
          duration_ms: Date.now() - start,
          next_steps:
            'For B2C, balance, and status tests, set MPESA_CALLBACK_BASE_URL to a public URL (e.g., via ngrok).',
        };
    }
  } catch (err: unknown) {
    const mpesaErr = err as { message?: string; suggestion?: string; code?: string };
    return {
      success: false,
      response: {
        error: mpesaErr.message ?? String(err),
        suggestion: mpesaErr.suggestion,
        code: mpesaErr.code,
      },
      duration_ms: Date.now() - start,
      next_steps: mpesaErr.suggestion,
    };
  }
}
