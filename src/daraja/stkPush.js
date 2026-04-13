import { http } from './client.js';
import { config } from '../utils/config.js';
import {
  darajaTimestamp,
  stkPushPassword,
  normalizeMsisdn,
} from '../utils/security.js';

/**
 * Initiate a Lipa Na M-Pesa Online (STK Push) payment.
 * The customer receives a PIN prompt on their phone.
 *
 * @param {object} p
 * @param {number|string} p.amount  - KES amount (min 1 in sandbox)
 * @param {string} p.phone          - payer MSISDN (any format)
 * @param {string} p.accountReference
 * @param {string} p.description
 * @param {string} p.callbackUrl    - must be reachable by Safaricom
 */
export async function stkPush({
  amount,
  phone,
  accountReference = 'DarajaPOC',
  description = 'Daraja POC test payment',
  callbackUrl,
}) {
  const timestamp = darajaTimestamp();
  const password = stkPushPassword(
    config.shortcode,
    config.passkey,
    timestamp,
  );
  const msisdn = normalizeMsisdn(phone);

  const payload = {
    BusinessShortCode: config.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: String(amount),
    PartyA: msisdn,
    PartyB: config.shortcode,
    PhoneNumber: msisdn,
    CallBackURL: callbackUrl,
    AccountReference: accountReference.slice(0, 12),
    TransactionDesc: description.slice(0, 13),
  };

  const { data } = await http.post('/mpesa/stkpush/v1/processrequest', payload);
  return data;
}

/**
 * Query the status of an STK Push by CheckoutRequestID.
 */
export async function stkPushQuery(checkoutRequestID) {
  const timestamp = darajaTimestamp();
  const password = stkPushPassword(
    config.shortcode,
    config.passkey,
    timestamp,
  );

  const payload = {
    BusinessShortCode: config.shortcode,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestID,
  };

  const { data } = await http.post('/mpesa/stkpushquery/v1/query', payload);
  return data;
}
