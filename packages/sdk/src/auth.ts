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

  // Retry once on auth failure.
  // Note: Daraja sandbox returns 404 with "Invalid Access Token" instead of 401
  // in two cases: (1) token genuinely expired, (2) app lacks API product access.
  // We retry once (handles case 1). If it fails again, we give a targeted error.
  http.interceptors.response.use(
    (res) => res,
    async (err) => {
      if (!axios.isAxiosError(err)) throw err;
      const { response, config: reqConfig } = err;
      const retried = (reqConfig as Record<string, unknown>)?.__retried;

      const isDaraja404Auth =
        response?.status === 404 &&
        String(response?.data?.errorMessage ?? '').toLowerCase().includes('invalid access token');

      const isAuthFailure = response?.status === 401 || isDaraja404Auth;

      if (isAuthFailure && !retried) {
        (reqConfig as Record<string, unknown>).__retried = true;
        await getToken(true);
        return http(reqConfig!);
      }

      // If we already retried and still get "Invalid Access Token" 404,
      // the app likely lacks the required API product on the Daraja portal.
      if (isDaraja404Auth && retried) {
        throw new AuthError({
          message: 'Daraja API access denied for this endpoint',
          suggestion:
            'Your Daraja app credentials are valid (OAuth works) but this specific API returned "Invalid Access Token". ' +
            'This usually means your app does not have the required API product enabled. ' +
            'Go to developer.safaricom.co.ke → My Apps → edit your app → ensure the relevant API (e.g., "Lipa Na M-Pesa Sandbox") is ticked.',
          httpStatus: 404,
          raw: response?.data,
        });
      }

      if (response) {
        throw mapHttpError(response.status, response.data);
      }
      throw err;
    },
  );

  return http;
}
