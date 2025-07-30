/**
 * FastMCP Authentication Base Classes - TypeScript Implementation
 * 
 * Base classes for OAuth providers and token verifiers using Effect.
 */

import { Effect, pipe } from "effect";
import { AccessToken } from "@modelcontextprotocol/sdk/types";

/**
 * Authentication errors using Effect's error handling
 */
export class AuthenticationError {
  readonly _tag = "AuthenticationError";
  constructor(readonly message: string, readonly cause?: unknown) {}
}

export class TokenExpiredError {
  readonly _tag = "TokenExpiredError";
  constructor(readonly message: string = "Token has expired") {}
}

export class InvalidTokenError {
  readonly _tag = "InvalidTokenError";
  constructor(readonly message: string = "Invalid token") {}
}

export class InsufficientScopesError {
  readonly _tag = "InsufficientScopesError";
  constructor(readonly required: string[], readonly provided: string[]) {}
}

/**
 * Base class for token verifiers (Resource Servers) using Effect.
 */
export abstract class TokenVerifier {
  readonly resourceServerUrl?: string;
  readonly requiredScopes: string[];

  constructor(
    resourceServerUrl?: string,
    requiredScopes?: string[]
  ) {
    this.resourceServerUrl = resourceServerUrl;
    this.requiredScopes = requiredScopes || [];
  }

  /**
   * Verify a bearer token and return access info if valid using Effect.
   */
  abstract verifyToken(
    token: string
  ): Effect.Effect<AccessToken, AuthenticationError | TokenExpiredError | InvalidTokenError | InsufficientScopesError>;
}

/**
 * OAuth authorization server provider configuration.
 */
export type ClientRegistrationOptions = {
  readonly enabled?: boolean;
  readonly metadata?: Record<string, unknown>;
};

/**
 * OAuth token revocation options.
 */
export type RevocationOptions = {
  readonly enabled?: boolean;
  readonly endpoint?: string;
};

/**
 * OAuth authorization code for the authorization flow.
 */
export type AuthorizationCode = {
  readonly code: string;
  readonly clientId: string;
  readonly redirectUri?: string;
  readonly redirectUriProvidedExplicitly?: boolean;
  readonly scopes: string[];
  readonly expiresAt: number;
  readonly codeChallenge?: string;
  readonly codeChallengeMethod?: string;
};

/**
 * OAuth refresh token for token refresh flow.
 */
export type RefreshToken = {
  readonly token: string;
  readonly clientId: string;
  readonly scopes: string[];
  readonly expiresAt?: number;
};

/**
 * OAuth authorization parameters.
 */
export type AuthorizationParams = {
  readonly clientId: string;
  readonly redirectUri?: string;
  readonly redirectUriProvidedExplicitly?: boolean;
  readonly scopes?: string[];
  readonly state?: string;
  readonly codeChallenge?: string;
  readonly codeChallengeMethod?: string;
};

/**
 * OAuth client information.
 */
export type OAuthClientInformation = {
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly redirectUris: string[];
  readonly scope?: string;
  readonly grantTypes?: string[];
  readonly responseTypes?: string[];
  readonly tokenEndpointAuthMethod?: string;
};

/**
 * OAuth token response.
 */
export type OAuthToken = {
  readonly accessToken: string;
  readonly tokenType: string;
  readonly expiresIn?: number;
  readonly refreshToken?: string;
  readonly scope?: string;
};

/**
 * OAuth provider errors
 */
export class OAuthError {
  readonly _tag = "OAuthError";
  constructor(readonly error: string, readonly description?: string) {}
}

export class ClientNotFoundError {
  readonly _tag = "ClientNotFoundError";
  constructor(readonly clientId: string) {}
}

export class InvalidGrantError {
  readonly _tag = "InvalidGrantError";
  constructor(readonly message: string) {}
}

/**
 * Base OAuth provider class using Effect.
 */
export abstract class OAuthProvider {
  readonly issuerUrl: string;
  readonly serviceDocumentationUrl?: string;
  readonly clientRegistrationOptions?: ClientRegistrationOptions;
  readonly revocationOptions?: RevocationOptions;
  readonly requiredScopes?: string[];
  readonly resourceServerUrl?: string;

  constructor(
    issuerUrl: string,
    serviceDocumentationUrl?: string,
    clientRegistrationOptions?: ClientRegistrationOptions,
    revocationOptions?: RevocationOptions,
    requiredScopes?: string[],
    resourceServerUrl?: string
  ) {
    this.issuerUrl = issuerUrl;
    this.serviceDocumentationUrl = serviceDocumentationUrl;
    this.clientRegistrationOptions = clientRegistrationOptions;
    this.revocationOptions = revocationOptions;
    this.requiredScopes = requiredScopes;
    this.resourceServerUrl = resourceServerUrl;
  }

  /**
   * Get client information by client ID using Effect.
   */
  abstract getClient(
    clientId: string
  ): Effect.Effect<OAuthClientInformation, ClientNotFoundError>;

  /**
   * Register a new client using Effect.
   */
  abstract registerClient(
    clientInfo: OAuthClientInformation
  ): Effect.Effect<void, OAuthError>;

  /**
   * Authorize a client and return redirect URI with authorization code using Effect.
   */
  abstract authorize(
    client: OAuthClientInformation,
    params: AuthorizationParams
  ): Effect.Effect<string, OAuthError>;

  /**
   * Load authorization code for verification using Effect.
   */
  abstract loadAuthorizationCode(
    client: OAuthClientInformation,
    authorizationCode: string
  ): Effect.Effect<AuthorizationCode, InvalidGrantError>;

  /**
   * Exchange authorization code for tokens using Effect.
   */
  abstract exchangeAuthorizationCode(
    client: OAuthClientInformation,
    authorizationCode: AuthorizationCode
  ): Effect.Effect<OAuthToken, InvalidGrantError>;

  /**
   * Load refresh token for verification using Effect.
   */
  abstract loadRefreshToken(
    client: OAuthClientInformation,
    refreshToken: string
  ): Effect.Effect<RefreshToken, InvalidGrantError>;

  /**
   * Exchange refresh token for new tokens using Effect.
   */
  abstract exchangeRefreshToken(
    client: OAuthClientInformation,
    refreshToken: RefreshToken,
    scopes: string[]
  ): Effect.Effect<OAuthToken, InvalidGrantError | InsufficientScopesError>;

  /**
   * Load access token for verification using Effect.
   */
  abstract loadAccessToken(
    token: string
  ): Effect.Effect<AccessToken, InvalidTokenError | TokenExpiredError>;

  /**
   * Revoke a token using Effect.
   */
  abstract revokeToken(
    token: AccessToken | RefreshToken
  ): Effect.Effect<void, OAuthError>;
}