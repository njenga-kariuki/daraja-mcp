import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { mapHttpError, AuthError } from './errors.js';
import type { ResolvedConfig } from './types.js';

/**
 * Creates an Axios instance with transparent OAuth token management.
 *
 * - Fetches and caches the access token on first request.
 * - Auto-refreshes when the token expires (60s before actual expiry).
 * - Retries once on 401 with a fresh token.
 */
export function createHttpClient(config: ResolvedConfig): AxiosInstance {
  let cachedToken: string | null = null;
  let tokenExpiresAt = 0;

  const http = axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeout,
    headers: { 'Content-Type': 'application/json' },
  });

  async function fetchToken(): Promise<string> {
    const basic = Buffer.from(
      `${config.consumerKey}:${config.consumerSecret}`,
    ).toString('base64');

    try {
      const { data } = await axios.get(
        `${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: { Authorization: `Basic ${basic}` },
          timeout: 15_000,
        },
      );

      const ttlMs = (Number(data.expires_in) - 60) * 1000;
      cachedToken = data.access_token;
      tokenExpiresAt = Date.now() + ttlMs;
      return cachedToken;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        throw mapHttpError(err.response.status, err.response.data);
      }
      throw new AuthError({
        message: 'Failed to fetch Daraja OAuth token',
        suggestion:
          'Could not connect to Daraja. Check your internet connection, and verify your consumer key/secret are correct.',
        cause: err,
      });
    }
  }

  async function getToken(force = false): Promise<string> {
    if (!force && cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
    return fetchToken();
  }

  // Attach bearer token to every request.
  http.interceptors.request.use(async (req: InternalAxiosRequestConfig) => {
    const token = await getToken();
    req.headers.Authorization = `Bearer ${token}`;
    return req;
  });

  // Retry once on 401 (expired token).
  http.interceptors.response.use(
    (res) => res,
    async (err) => {
      if (!axios.isAxiosError(err)) throw err;
      const { response, config: reqConfig } = err;
      const retried = (reqConfig as Record<string, unknown>)?.__retried;
      if (response?.status === 401 && !retried) {
        (reqConfig as Record<string, unknown>).__retried = true;
        await getToken(true);
        return http(reqConfig!);
      }
      if (response) {
        throw mapHttpError(response.status, response.data);
      }
      throw err;
    },
  );

  return http;
}
