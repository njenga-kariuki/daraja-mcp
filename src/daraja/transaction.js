import { http } from './client.js';
import { config } from '../utils/config.js';
import { buildSecurityCredential } from '../utils/security.js';

/**
 * Query the status of any M-Pesa transaction by TransactionID.
 * IdentifierType: 1 = MSISDN, 2 = Till, 4 = Shortcode.
 */
export async function transactionStatus({
  transactionId,
  partyA = config.b2cShortcode,
  identifierType = '4',
  remarks = 'Status query',
  occasion = 'POC',
  resultUrl,
  queueTimeoutUrl,
}) {
  const payload = {
    Initiator: config.initiatorName,
    SecurityCredential: buildSecurityCredential(),
    CommandID: 'TransactionStatusQuery',
    TransactionID: transactionId,
    PartyA: partyA,
    IdentifierType: identifierType,
    ResultURL: resultUrl,
    QueueTimeOutURL: queueTimeoutUrl,
    Remarks: remarks,
    Occasion: occasion,
  };

  const { data } = await http.post(
    '/mpesa/transactionstatus/v1/query',
    payload,
  );
  return data;
}
