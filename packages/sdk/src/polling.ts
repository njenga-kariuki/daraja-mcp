import type { AxiosInstance } from 'axios';
import { darajaTimestamp, stkPassword } from './security.js';
import { mapDarajaError, TimeoutError } from './errors.js';
import type { ResolvedConfig, CollectResult } from './types.js';

/**
 * Polls the STK Push Query endpoint until the transaction resolves or times out.
 * This is what makes mpesa.collect() work without callbacks.
 */
export async function pollStkStatus(
  http: AxiosInstance,
  config: ResolvedConfig,
  checkoutRequestId: string,
  opts: { interval: number; timeout: number },
): Promise<CollectResult> {
  const deadline = Date.now() + opts.timeout;

  while (Date.now() < deadline) {
    await sleep(opts.interval);

    const timestamp = darajaTimestamp();
    const password = stkPassword(config.shortcode, config.passkey, timestamp);

    try {
      const { data } = await http.post('/mpesa/stkpushquery/v1/query', {
        BusinessShortCode: config.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      });

      const resultCode = String(data.ResultCode);

      // Still processing
      if (resultCode === '1032' && data.ResultDesc?.includes('pending')) continue;

      // Success
      if (resultCode === '0') {
        return {
          id: checkoutRequestId,
          merchantRequestId: data.MerchantRequestID,
          status: 'completed',
          receipt: data.ResultDesc?.match(/Receipt Number: (\w+)/)?.[1],
          raw: data,
        };
      }

      // User cancelled
      if (resultCode === '1032') {
        return {
          id: checkoutRequestId,
          merchantRequestId: data.MerchantRequestID,
          status: 'cancelled',
          errorCode: resultCode,
          errorMessage: data.ResultDesc,
          raw: data,
        };
      }

      // Other failures
      const err = mapDarajaError(resultCode, data.ResultDesc, data);
      return {
        id: checkoutRequestId,
        merchantRequestId: data.MerchantRequestID,
        status: 'failed',
        errorCode: resultCode,
        errorMessage: err.suggestion,
        raw: data,
      };
    } catch {
      // Swallow query errors during polling — the transaction may still be processing.
      // Only throw if we've exceeded the deadline.
      if (Date.now() >= deadline) break;
    }
  }

  throw new TimeoutError({
    message: `STK Push polling timed out after ${opts.timeout}ms`,
    suggestion:
      'The STK Push status could not be determined within the timeout. ' +
      'The payment may still complete — check with mpesa.status() or wait for the callback.',
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
