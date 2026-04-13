import { http } from './client.js';
import { config } from '../utils/config.js';
import { buildSecurityCredential, normalizeMsisdn } from '../utils/security.js';

/**
 * Send a B2C payment (Business to Customer).
 *
 * CommandID options:
 *  - SalaryPayment          → salaries to registered M-Pesa users
 *  - BusinessPayment        → normal payouts
 *  - PromotionPayment       → promotional cash prizes
 */
export async function b2cPayment({
  amount,
  phone,
  commandID = 'BusinessPayment',
  remarks = 'Daraja POC B2C',
  occasion = 'POC',
  resultUrl,
  queueTimeoutUrl,
}) {
  const securityCredential = buildSecurityCredential();

  const payload = {
    OriginatorConversationID: `POC-${Date.now()}`,
    InitiatorName: config.initiatorName,
    SecurityCredential: securityCredential,
    CommandID: commandID,
    Amount: String(amount),
    PartyA: config.b2cShortcode,
    PartyB: normalizeMsisdn(phone),
    Remarks: remarks,
    QueueTimeOutURL: queueTimeoutUrl,
    ResultURL: resultUrl,
    Occasion: occasion,
  };

  const { data } = await http.post('/mpesa/b2c/v1/paymentrequest', payload);
  return data;
}
