import axios from 'axios';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

/**
 * Axios instance pointed at the Daraja base URL with an OAuth interceptor
 * that transparently caches and refreshes the access token.
 */
const http = axios.create({
  baseURL: config.baseUrl,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

let cachedToken = null;
let tokenExpiresAt = 0; // epoch ms

async function fetchAccessToken() {
  const basic = Buffer.from(
    `${config.consumerKey}:${config.consumerSecret}`,
  ).toString('base64');

  const { data } = await axios.get(
    `${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${basic}` }, timeout: 15_000 },
  );

  // Daraja returns expires_in as a string number of seconds (typically "3599").
  const ttlMs = (Number(data.expires_in) - 60) * 1000; // refresh 60s early
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + ttlMs;
  logger.info(`Daraja OAuth token acquired (expires in ${data.expires_in}s)`);
  return cachedToken;
}

export async function getAccessToken({ force = false } = {}) {
  if (!force && cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  return fetchAccessToken();
}

// Attach token to every request automatically.
http.interceptors.request.use(async (req) => {
  // Skip for the OAuth call itself (we do that via the raw axios above).
  const token = await getAccessToken();
  req.headers.Authorization = `Bearer ${token}`;
  logger.debug(`→ ${req.method?.toUpperCase()} ${req.url}`);
  return req;
});

// Retry once on 401 (expired token).
http.interceptors.response.use(
  (res) => {
    logger.debug(`← ${res.status} ${res.config.url}`);
    return res;
  },
  async (err) => {
    const { response, config: reqConfig } = err;
    if (response?.status === 401 && !reqConfig.__retried) {
      reqConfig.__retried = true;
      await getAccessToken({ force: true });
      return http(reqConfig);
    }
    logger.error(
      `Daraja error: ${response?.status} ${JSON.stringify(response?.data)}`,
    );
    return Promise.reject(err);
  },
);

export { http };
