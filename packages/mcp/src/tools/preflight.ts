import { handleValidate } from './validate.js';
import { createClient } from '@daraja-kit/sdk';

interface PreflightInput {
  code: string;
  callbackUrl?: string;
}

interface PreflightIssue {
  severity: 'error' | 'warning' | 'info';
  line?: number;
  message: string;
  fix: string;
}

interface PreflightOutput {
  codeIssues: PreflightIssue[];
  codeScore: number;
  callbackReachable: boolean | null;
  callbackDetail?: string;
  oauthValid: boolean;
  oauthDetail?: string;
  overallReady: boolean;
  blockers: string[];
}

export const preflightSchema = {
  name: 'daraja_preflight',
  description:
    'Run a pre-deployment health check on an M-Pesa integration. Validates code for common mistakes, ' +
    'tests callback URL reachability, and verifies sandbox OAuth credentials — all before you deploy. ' +
    'Use this to catch issues proactively before they become runtime errors.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      code: {
        type: 'string',
        description: 'The source code to validate.',
      },
      callbackUrl: {
        type: 'string',
        description: 'Optional callback URL to test for reachability. If provided, an HTTP request will be sent to verify the URL responds.',
      },
    },
    required: ['code'],
  },
};

async function checkCallbackUrl(url: string): Promise<{ reachable: boolean; detail: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok || response.status < 500) {
      return { reachable: true, detail: `URL responded with HTTP ${response.status}.` };
    }
    return { reachable: false, detail: `URL returned HTTP ${response.status}. Daraja requires your callback to return HTTP 200.` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('abort')) {
      return { reachable: false, detail: 'Callback URL timed out after 10 seconds. Daraja will also time out — check that the URL is publicly accessible.' };
    }
    return { reachable: false, detail: `Cannot reach callback URL: ${message}. Ensure it is publicly accessible over HTTPS.` };
  }
}

async function checkOAuth(): Promise<{ valid: boolean; detail: string }> {
  try {
    const mpesa = createClient();
    // A lightweight call that exercises OAuth without triggering a real transaction.
    // We just need to verify the token fetch works.
    await (mpesa as any).auth.getToken();
    return { valid: true, detail: 'OAuth token obtained successfully from sandbox.' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, detail: `OAuth failed: ${message}. Check your consumer key/secret or use shared sandbox credentials (createClient() with no arguments).` };
  }
}

export async function handlePreflight(input: PreflightInput): Promise<PreflightOutput> {
  // Step 1: Run code validation (reuse existing validate logic).
  const validateResult = handleValidate({ code: input.code });

  // Step 2: Check callback URL if provided.
  let callbackReachable: boolean | null = null;
  let callbackDetail: string | undefined;

  if (input.callbackUrl) {
    const callbackResult = await checkCallbackUrl(input.callbackUrl);
    callbackReachable = callbackResult.reachable;
    callbackDetail = callbackResult.detail;
  }

  // Step 3: Check OAuth.
  const oauthResult = await checkOAuth();

  // Step 4: Compute blockers and overall readiness.
  const blockers: string[] = [];

  const codeErrors = validateResult.issues.filter((i) => i.severity === 'error');
  if (codeErrors.length > 0) {
    blockers.push(`${codeErrors.length} code error(s): ${codeErrors.map((e) => e.message).join('; ')}`);
  }

  if (callbackReachable === false) {
    blockers.push(`Callback URL not reachable: ${callbackDetail}`);
  }

  if (!oauthResult.valid) {
    blockers.push(`OAuth failed: ${oauthResult.detail}`);
  }

  return {
    codeIssues: validateResult.issues,
    codeScore: validateResult.score,
    callbackReachable,
    callbackDetail,
    oauthValid: oauthResult.valid,
    oauthDetail: oauthResult.detail,
    overallReady: blockers.length === 0,
    blockers,
  };
}
