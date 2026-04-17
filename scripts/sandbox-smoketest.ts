/**
 * Daraja 4.0 SDK sandbox smoke test.
 *
 * Exercises every SDK method against the Daraja sandbox using the bundled
 * community credentials and the test phone (254708374149). No real money moves.
 *
 *   collect, qr   — always run (no callback or cert required)
 *   send, balance — run when MPESA_CALLBACK_BASE_URL is set
 *   status, reverse — run when MPESA_CALLBACK_BASE_URL and SMOKE_TRANSACTION_ID are set
 *
 * Any method that requires the initiator certificate is skipped with a clear
 * message if packages/sdk/certs/sandbox.cer is missing.
 *
 *   npm run smoke
 *   MPESA_CALLBACK_BASE_URL=https://your-ngrok-url npm run smoke
 *   MPESA_CALLBACK_BASE_URL=… SMOKE_TRANSACTION_ID=QKJ41HAY4I npm run smoke
 */
import { createClient, SANDBOX, type MpesaError } from '@daraja-kit/sdk';

class SkipError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SkipError';
  }
}

interface StepResult {
  name: string;
  status: 'ok' | 'skipped' | 'failed';
  detail: string;
}

const results: StepResult[] = [];
const callbackBase = process.env.MPESA_CALLBACK_BASE_URL;
const realTxId = process.env.SMOKE_TRANSACTION_ID;
const testPhone = SANDBOX.testPhone;

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET,
});

async function step(name: string, fn: () => Promise<string>): Promise<void> {
  process.stdout.write(`→ ${name.padEnd(22)} `);
  try {
    const detail = await fn();
    console.log('✔', detail);
    results.push({ name, status: 'ok', detail });
  } catch (err) {
    if (err instanceof SkipError) {
      console.log('⏭  skipped —', err.message);
      results.push({ name, status: 'skipped', detail: err.message });
      return;
    }
    const mpesaErr = err as MpesaError;
    const message = mpesaErr?.message ?? String(err);
    if (/CERT_NOT_FOUND/i.test(message) || /certificate not found/i.test(message)) {
      const pathMatch = message.match(/not found at (\S+)/);
      const where = pathMatch?.[1] ?? '~/.daraja/sandbox.cer';
      console.log(`⏭  skipped — sandbox cert missing at ${where}`);
      results.push({ name, status: 'skipped', detail: 'cert missing' });
      return;
    }
    console.log('✗', message);
    if (mpesaErr?.suggestion) console.log(`   suggestion: ${mpesaErr.suggestion}`);
    results.push({ name, status: 'failed', detail: message });
  }
}

function requireCallback(): string {
  if (!callbackBase) {
    throw new SkipError('set MPESA_CALLBACK_BASE_URL to exercise this method');
  }
  return callbackBase;
}

function requireRealTxId(): string {
  if (!realTxId) {
    throw new SkipError('set SMOKE_TRANSACTION_ID to a real sandbox tx ID');
  }
  return realTxId;
}

console.log('Daraja 4.0 SDK sandbox smoke test');
console.log(`  test phone:    ${testPhone}`);
console.log(`  callback base: ${callbackBase ?? '(not set — send/balance/status/reverse will skip)'}`);
const effectiveKey = process.env.DARAJA_CONSUMER_KEY ?? SANDBOX.consumerKey;
console.log(`  consumer key:  ${effectiveKey.slice(0, 8)}… (${process.env.DARAJA_CONSUMER_KEY ? 'from env' : 'bundled sandbox'})`);
console.log('');

await step('collect (STK Push)', async () => {
  const result = await mpesa.collect({
    amount: 1,
    phone: testPhone,
    reference: 'SmokeTest',
    description: 'Smoke',
    poll: false,
  });
  return `id=${result.id} status=${result.status}`;
});

await step('qr (dynamic QR)', async () => {
  const result = await mpesa.qr({ amount: 1, reference: 'SmokeTest' });
  const snippet = result.qrCode ? `${String(result.qrCode).slice(0, 24)}…` : '(empty qrCode)';
  return `qrCode=${snippet}`;
});

await step('send (B2C)', async () => {
  const base = requireCallback();
  const result = await mpesa.send({
    amount: 10,
    phone: testPhone,
    type: 'salary',
    callbackUrl: `${base}/callbacks/b2c`,
  });
  return `conversationId=${result.conversationId}`;
});

await step('balance', async () => {
  const base = requireCallback();
  const result = await mpesa.balance({ callbackUrl: `${base}/callbacks/balance` });
  return `conversationId=${result.conversationId}`;
});

await step('status', async () => {
  const base = requireCallback();
  const txId = requireRealTxId();
  const result = await mpesa.status({
    transactionId: txId,
    callbackUrl: `${base}/callbacks/status`,
  });
  return `conversationId=${result.conversationId}`;
});

await step('reverse', async () => {
  const base = requireCallback();
  const txId = requireRealTxId();
  const result = await mpesa.reverse({
    transactionId: txId,
    amount: 1,
    callbackUrl: `${base}/callbacks/reversal`,
  });
  return `conversationId=${result.conversationId}`;
});

console.log('');
const ok = results.filter((r) => r.status === 'ok').length;
const skipped = results.filter((r) => r.status === 'skipped').length;
const failed = results.filter((r) => r.status === 'failed').length;
console.log(`Summary: ${ok} ok · ${skipped} skipped · ${failed} failed`);

if (failed > 0) {
  console.log('\nFailures:');
  for (const r of results.filter((r) => r.status === 'failed')) {
    console.log(`  - ${r.name}: ${r.detail}`);
  }
  process.exit(1);
}

if (skipped > 0) {
  console.log('\nTo exercise skipped methods:');
  console.log('  1. Download SandboxCertificate.cer from developer.safaricom.co.ke → your app → Keys,');
  console.log('     then save at ~/.daraja/sandbox.cer (or set MPESA_CERT_PATH). B2C family requires it.');
  console.log('  2. Set MPESA_CALLBACK_BASE_URL (ngrok or similar) so callback-bearing methods can run.');
  console.log('  3. Set SMOKE_TRANSACTION_ID to a real sandbox tx ID for status/reverse.');
}
