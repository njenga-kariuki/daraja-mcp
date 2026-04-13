import { http } from './client.js';
import { config } from '../utils/config.js';
import { buildSecurityCredential } from '../utils/security.js';

/**
 * Query the account balance for a shortcode.
 */
export async function accountBalance({
  partyA = config.b2cShortcode,
  identifierType = '4',
  remarks = 'Balance query',
  resultUrl,
  queueTimeoutUrl,
}) {
  const payload = {
    Initiator: config.initiatorName,
    SecurityCredential: buildSecurityCredential(),
    CommandID: 'AccountBalance',
    PartyA: partyA,
    IdentifierType: identifierType,
    Remarks: remarks,
    QueueTimeOutURL: queueTimeoutUrl,
    ResultURL: resultUrl,
  };

  const { data } = await http.post('/mpesa/accountbalance/v1/query', payload);
  return data;
}
