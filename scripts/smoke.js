/**
 * Smoke test: verifies OAuth + STK Push against the Daraja sandbox.
 * Run:  node scripts/smoke.js 254708374149 1
 */
import { getAccessToken } from '../src/daraja/client.js';
import { stkPush } from '../src/daraja/stkPush.js';
import { config, callbackUrl } from '../src/utils/config.js';

const [, , phone = '254708374149', amount = '1'] = process.argv;

(async () => {
  console.log(`→ Env:      ${config.env} (${config.baseUrl})`);
  console.log(`→ Shortcode: ${config.shortcode}`);

  console.log('\n[1/2] Fetching OAuth token…');
  const token = await getAccessToken({ force: true });
  console.log('    ✔ token prefix:', token.slice(0, 12) + '…');

  console.log('\n[2/2] Initiating STK Push…');
  const result = await stkPush({
    amount,
    phone,
    accountReference: 'SmokeTest',
    description: 'Smoke',
    callbackUrl: callbackUrl('/callbacks/stkpush'),
  });
  console.log('    ✔ response:');
  console.log(JSON.stringify(result, null, 2));

  if (result.ResponseCode === '0') {
    console.log('\n✅ Smoke test OK — accept the prompt on your phone.');
  } else {
    console.log('\n⚠️  Unexpected response — check the payload above.');
  }
})().catch((err) => {
  console.error('\n❌ Smoke test failed:');
  console.error(err.response?.data ?? err.message);
  process.exit(1);
});
