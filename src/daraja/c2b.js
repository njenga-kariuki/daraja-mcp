import { http } from './client.js';
import { config } from '../utils/config.js';
import { normalizeMsisdn } from '../utils/security.js';

/**
 * Register validation & confirmation URLs for C2B (paybill / till).
 * ResponseType: "Completed" (fail closed) or "Cancelled" (fail open).
 */
export async function registerC2BUrls({
  validationUrl,
  confirmationUrl,
  responseType = 'Completed',
  shortCode = config.shortcode,
}) {
  const payload = {
    ShortCode: shortCode,
    ResponseType: responseType,
    ConfirmationURL: confirmationUrl,
    ValidationURL: validationUrl,
  };
  const { data } = await http.post('/mpesa/c2b/v1/registerurl', payload);
  return data;
}

/**
 * Simulate a C2B payment (SANDBOX ONLY).
 * Test MSISDN: 254708374149.
 */
export async function simulateC2B({
  amount,
  phone,
  billRefNumber = 'DarajaPOC',
  commandID = 'CustomerPayBillOnline',
  shortCode = config.shortcode,
}) {
  if (config.env === 'production') {
    throw new Error('C2B simulate is only available in sandbox');
  }
  const payload = {
    ShortCode: shortCode,
    CommandID: commandID, // CustomerPayBillOnline | CustomerBuyGoodsOnline
    Amount: String(amount),
    Msisdn: normalizeMsisdn(phone),
    BillRefNumber: billRefNumber,
  };
  const { data } = await http.post('/mpesa/c2b/v1/simulate', payload);
  return data;
}
