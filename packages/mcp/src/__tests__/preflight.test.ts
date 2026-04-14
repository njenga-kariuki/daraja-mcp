import { describe, it, expect } from 'vitest';
import { handlePreflight } from '../tools/preflight.js';

const CLEAN_CODE = `
import { createClient } from '@daraja-kit/sdk';
const mpesa = createClient();
try {
  const result = await mpesa.collect({ amount: 100, phone: '254712345678' });
  console.log(result);
} catch (err) {
  console.error(err.suggestion);
}
`;

const CODE_WITH_HARDCODED_CREDS = `
const mpesa = createClient({
  consumerKey: 'ABC123DEF456GHI789',
  consumerSecret: 'XYZ987WVU654TSR321',
});
`;

const CODE_WITH_LOCALHOST_CALLBACK = `
const result = await mpesa.send({
  amount: 100,
  phone: '254712345678',
  callbackUrl: 'http://localhost:3000/callback',
});
`;

describe('handlePreflight — code validation', () => {
  it('returns no code errors for clean code', async () => {
    const result = await handlePreflight({ code: CLEAN_CODE });
    const errors = result.codeIssues.filter((i) => i.severity === 'error');
    expect(errors.length).toBe(0);
    expect(result.codeScore).toBeGreaterThanOrEqual(90);
  });

  it('detects hardcoded credentials', async () => {
    const result = await handlePreflight({ code: CODE_WITH_HARDCODED_CREDS });
    const credIssue = result.codeIssues.find((i) => i.message.includes('Hardcoded'));
    expect(credIssue).toBeTruthy();
    expect(credIssue!.severity).toBe('error');
  });

  it('detects localhost callback URLs', async () => {
    const result = await handlePreflight({ code: CODE_WITH_LOCALHOST_CALLBACK });
    const localhostIssue = result.codeIssues.find((i) => i.message.includes('localhost'));
    expect(localhostIssue).toBeTruthy();
    expect(localhostIssue!.severity).toBe('error');
  });
});

describe('handlePreflight — callback URL checking', () => {
  it('returns null for callbackReachable when no URL provided', async () => {
    const result = await handlePreflight({ code: CLEAN_CODE });
    expect(result.callbackReachable).toBeNull();
    expect(result.callbackDetail).toBeUndefined();
  });

  it('detects unreachable callback URL', async () => {
    const result = await handlePreflight({
      code: CLEAN_CODE,
      callbackUrl: 'https://localhost:59999/definitely-not-running',
    });
    expect(result.callbackReachable).toBe(false);
    expect(result.callbackDetail).toBeTruthy();
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.overallReady).toBe(false);
  });
});

describe('handlePreflight — OAuth check', () => {
  it('checks OAuth and returns result', async () => {
    const result = await handlePreflight({ code: CLEAN_CODE });
    // OAuth validity depends on network — just check the field exists
    expect(typeof result.oauthValid).toBe('boolean');
    expect(result.oauthDetail).toBeTypeOf('string');
  });
});

describe('handlePreflight — overall readiness', () => {
  it('marks code-only errors as not ready', async () => {
    const result = await handlePreflight({ code: CODE_WITH_HARDCODED_CREDS });
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.blockers.some((b) => b.includes('code error'))).toBe(true);
  });

  it('includes callback in blockers when unreachable', async () => {
    const result = await handlePreflight({
      code: CLEAN_CODE,
      callbackUrl: 'https://localhost:59999/nope',
    });
    expect(result.blockers.some((b) => b.includes('Callback'))).toBe(true);
  });
});
