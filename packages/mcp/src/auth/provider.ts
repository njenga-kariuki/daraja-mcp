/**
 * DarajaOAuthProvider — OAuth 2.1 provider for the Daraja MCP server.
 *
 * Implements the MCP SDK's OAuthServerProvider interface with in-memory stores.
 * Clients register with their Daraja consumer key + secret, and receive
 * MCP-scoped access tokens for authenticating with the remote MCP server.
 */
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import type { Response } from 'express';
import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type {
  OAuthClientInformationFull,
  OAuthTokens,
  OAuthTokenRevocationRequest,
} from '@modelcontextprotocol/sdk/shared/auth.js';

// ── In-memory stores ────────────────────────────────────────────────────────

interface StoredClient extends OAuthClientInformationFull {
  /** Daraja consumer key provided during registration. */
  darajaConsumerKey?: string;
  /** Daraja consumer secret provided during registration. */
  darajaConsumerSecret?: string;
}

interface AuthorizationRecord {
  clientId: string;
  code: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  expiresAt: number;
}

interface TokenRecord {
  accessToken: string;
  refreshToken?: string;
  clientId: string;
  scopes: string[];
  expiresAt: number;
}

// ── Client Store ────────────────────────────────────────────────────────────

class DarajaClientsStore implements OAuthRegisteredClientsStore {
  private clients = new Map<string, StoredClient>();

  getClient(clientId: string): StoredClient | undefined {
    return this.clients.get(clientId);
  }

  registerClient(
    client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>,
  ): StoredClient {
    const clientId = `daraja_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const clientSecret = randomBytes(32).toString('hex');

    const stored: StoredClient = {
      ...client,
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };

    this.clients.set(clientId, stored);
    return stored;
  }
}

// ── OAuth Provider ──────────────────────────────────────────────────────────

const TOKEN_TTL_SECONDS = 3600; // 1 hour
const CODE_TTL_SECONDS = 300;   // 5 minutes

export class DarajaOAuthProvider implements OAuthServerProvider {
  private readonly _clientsStore = new DarajaClientsStore();
  private readonly authCodes = new Map<string, AuthorizationRecord>();
  private readonly tokens = new Map<string, TokenRecord>();
  private readonly revokedTokens = new Set<string>();

  get clientsStore(): OAuthRegisteredClientsStore {
    return this._clientsStore;
  }

  /**
   * Handle authorization request.
   * Issues an authorization code and redirects back to the client.
   * In a production deployment, this would show a consent screen.
   */
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    const code = randomBytes(32).toString('hex');

    this.authCodes.set(code, {
      clientId: client.client_id,
      code,
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      scopes: params.scopes ?? [],
      expiresAt: Date.now() + CODE_TTL_SECONDS * 1000,
    });

    // Auto-approve: redirect back with the authorization code.
    // A production deployment would present a consent UI here.
    const redirectUrl = new URL(params.redirectUri);
    redirectUrl.searchParams.set('code', code);
    if (params.state) {
      redirectUrl.searchParams.set('state', params.state);
    }

    res.redirect(302, redirectUrl.toString());
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const record = this.authCodes.get(authorizationCode);
    if (!record) {
      throw new Error('Invalid authorization code');
    }
    if (Date.now() > record.expiresAt) {
      this.authCodes.delete(authorizationCode);
      throw new Error('Authorization code expired');
    }
    return record.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    _redirectUri?: string,
    _resource?: URL,
  ): Promise<OAuthTokens> {
    const record = this.authCodes.get(authorizationCode);
    if (!record) {
      throw new Error('Invalid authorization code');
    }
    if (record.clientId !== client.client_id) {
      throw new Error('Authorization code was issued to a different client');
    }
    if (Date.now() > record.expiresAt) {
      this.authCodes.delete(authorizationCode);
      throw new Error('Authorization code expired');
    }

    // Consume the code (one-time use)
    this.authCodes.delete(authorizationCode);

    return this.issueTokens(client.client_id, record.scopes);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    _resource?: URL,
  ): Promise<OAuthTokens> {
    // Find the token record by refresh token
    let found: TokenRecord | undefined;
    for (const record of this.tokens.values()) {
      if (record.refreshToken === refreshToken && record.clientId === client.client_id) {
        found = record;
        break;
      }
    }

    if (!found) {
      throw new Error('Invalid refresh token');
    }

    if (this.revokedTokens.has(refreshToken)) {
      throw new Error('Refresh token has been revoked');
    }

    // Revoke the old tokens
    this.tokens.delete(found.accessToken);
    this.revokedTokens.add(found.accessToken);
    if (found.refreshToken) {
      this.revokedTokens.add(found.refreshToken);
    }

    return this.issueTokens(client.client_id, scopes ?? found.scopes);
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (this.revokedTokens.has(token)) {
      throw new Error('Token has been revoked');
    }

    const record = this.tokens.get(token);
    if (!record) {
      throw new Error('Invalid access token');
    }

    if (Date.now() > record.expiresAt) {
      this.tokens.delete(token);
      throw new Error('Access token expired');
    }

    return {
      token,
      clientId: record.clientId,
      scopes: record.scopes,
      expiresAt: Math.floor(record.expiresAt / 1000),
    };
  }

  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    this.revokedTokens.add(request.token);
    this.tokens.delete(request.token);
  }

  private issueTokens(clientId: string, scopes: string[]): OAuthTokens {
    const accessToken = randomBytes(32).toString('hex');
    const refreshToken = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + TOKEN_TTL_SECONDS * 1000;

    this.tokens.set(accessToken, {
      accessToken,
      refreshToken,
      clientId,
      scopes,
      expiresAt,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
    };
  }
}
