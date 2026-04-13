import { http } from './client.js';
import { config } from '../utils/config.js';
import { buildSecurityCredential } from '../utils/security.js';

/**
 * Reverse an M-Pesa transaction by TransactionID.
 * ReceiverIdentifierType 11 = shortcode.
 */
export async function reverseTransaction({
  transactionId,
  amount,
  receiverParty = config.b2cShortcode,
  receiverIdentifierType = '11',
  remarks = 'Reversal',
  occasion = 'POC',
  resultUrl,
  queueTimeoutUrl,
}) {
  const payload = {
    Initiator: config.initiatorName,
    SecurityCredential: buildSecurityCredential(),
    CommandID: 'TransactionReversal',
    TransactionID: transactionId,
    Amount: String(amount),
    ReceiverParty: receiverParty,
    ReceiverIdentifierType: receiverIdentifierType,
    ResultURL: resultUrl,
    QueueTimeOutURL: queueTimeoutUrl,
    Remarks: remarks,
    Occasion: occasion,
  };

  const { data } = await http.post('/mpesa/reversal/v1/request', payload);
  return data;
}
