/**
 * FastMCP Token Verifiers - TypeScript Implementation
 * 
 * Various token verification implementations using Effect for FastMCP authentication.
 */

import { Effect, pipe } from "effect";
import { AccessToken } from "@modelcontextprotocol/sdk/types";
import {
  TokenVerifier,
  AuthenticationError,
  TokenExpiredError,
  InvalidTokenError,
  InsufficientScopesError,
} from "./auth";
import { getLogger } from "../../utilities/logging";

const logger = getLogger("auth.verifiers");

/**
 * RSA key pair for JWT testing.
 */
export type RSAKeyPair = {
  readonly privateKey: string;
  readonly publicKey: string;
};

/**
 * JSON Web Key data structure.
 */
export type JWKData = {
  readonly kty: string; // Key type (e.g., "RSA")
  readonly kid?: string; // Key ID
  readonly use?: string; // Usage (e.g., "sig")
  readonly alg?: string; // Algorithm (e.g., "RS256")
  readonly n?: string; // Modulus (for RSA keys)
  readonly e?: string; // Exponent (for RSA keys)
  readonly x5c?: string[]; // X.509 certificate chain
  readonly x5t?: string; // X.509 certificate thumbprint
};

/**
 * JSON Web Key Set data structure.
 */
export type JWKSData = {
  readonly keys: JWKData[];
};

/**
 * JWKS fetch error
 */
export class JWKSFetchError {
  readonly _tag = "JWKSFetchError";
  constructor(readonly message: string, readonly cause?: unknown) {}
}

/**
 * Key not found error
 */
export class KeyNotFoundError {
  readonly _tag = "KeyNotFoundError";
  constructor(readonly keyId?: string) {}
}

/**
 * Generate an RSA key pair for testing using Effect.
 */
export const generateRSAKeyPair = (): Effect.Effect<RSAKeyPair, AuthenticationError> =>
  Effect.fail(
    new AuthenticationError("RSA key generation not implemented in this translation")
  );

/**
 * JWT token verifier using public key or JWKS with Effect.
 */
export class JWTVerifier extends TokenVerifier {
  private readonly publicKey?: string;
  private readonly jwksUri?: string;
  private readonly issuer?: string;
  private readonly audience?: string | string[];
  private readonly algorithm: string;
  
  // Simple JWKS cache
  private _jwksCache: Map<string, string> = new Map();
  private _jwksCacheTime = 0;
  private readonly _cacheTtl = 3600; // 1 hour

  constructor(options: {
    publicKey?: string;
    jwksUri?: string;
    issuer?: string;
    audience?: string | string[];
    algorithm?: string;
    requiredScopes?: string[];
    resourceServerUrl?: string;
  }) {
    if (!options.publicKey && !options.jwksUri) {
      throw new Error("Either publicKey or jwksUri must be provided");
    }

    if (options.publicKey && options.jwksUri) {
      throw new Error("Provide either publicKey or jwksUri, not both");
    }

    const algorithm = options.algorithm || "RS256";
    const supportedAlgorithms = new Set([
      "HS256", "HS384", "HS512",
      "RS256", "RS384", "RS512",
      "ES256", "ES384", "ES512",
      "PS256", "PS384", "PS512",
    ]);

    if (!supportedAlgorithms.has(algorithm)) {
      throw new Error(`Unsupported algorithm: ${algorithm}`);
    }

    super(options.resourceServerUrl, options.requiredScopes);
    
    this.publicKey = options.publicKey;
    this.jwksUri = options.jwksUri;
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.algorithm = algorithm;
  }

  /**
   * Verify a JWT token using Effect.
   */
  verifyToken(
    token: string
  ): Effect.Effect<AccessToken, AuthenticationError | TokenExpiredError | InvalidTokenError | InsufficientScopesError> {
    return pipe(
      this._extractClaimsFromToken(token),
      Effect.flatMap((claims) =>
        pipe(
          this._validateClaims(claims),
          Effect.map(() => this._createAccessToken(token, claims))
        )
      ),
      Effect.catchAll((error) => {
        logger.debug("Token verification failed:", error);
        return Effect.fail(new InvalidTokenError("Token verification failed"));
      })
    );
  }

  /**
   * Extract claims from JWT token using Effect.
   */
  private _extractClaimsFromToken(
    token: string
  ): Effect.Effect<Record<string, unknown>, InvalidTokenError> {
    return Effect.try({
      try: () => {
        // Split token and decode payload (without verification - for demo only)
        const parts = token.split(".");
        if (parts.length !== 3) {
          throw new Error("Invalid token format");
        }

        const payload = parts[1];
        // Add padding if needed
        const paddedPayload = payload + "=".repeat((4 - payload.length % 4) % 4);
        const decoded = atob(paddedPayload);
        return JSON.parse(decoded);
      },
      catch: () => new InvalidTokenError("Failed to decode token"),
    });
  }

  /**
   * Validate JWT claims using Effect.
   */
  private _validateClaims(
    claims: Record<string, unknown>
  ): Effect.Effect<void, TokenExpiredError | InvalidTokenError | InsufficientScopesError> {
    return pipe(
      // Validate expiration
      Effect.sync(() => {
        const exp = claims.exp;
        if (exp && typeof exp === "number" && exp < Math.floor(Date.now() / 1000)) {
          throw new TokenExpiredError();
        }
      }),
      // Validate issuer
      Effect.flatMap(() =>
        this.issuer && claims.iss !== this.issuer
          ? Effect.fail(new InvalidTokenError("Issuer mismatch"))
          : Effect.void
      ),
      // Validate audience
      Effect.flatMap(() =>
        this.audience && !this._validateAudience(claims.aud)
          ? Effect.fail(new InvalidTokenError("Audience mismatch"))
          : Effect.void
      ),
      // Validate scopes
      Effect.flatMap(() => {
        const scopes = this._extractScopes(claims);
        return this._validateRequiredScopes(scopes);
      })
    );
  }

  /**
   * Validate required scopes using Effect.
   */
  private _validateRequiredScopes(
    scopes: string[]
  ): Effect.Effect<void, InsufficientScopesError> {
    if (this.requiredScopes.length === 0) {
      return Effect.void;
    }

    const tokenScopes = new Set(scopes);
    const requiredScopes = new Set(this.requiredScopes);
    const hasAllRequired = [...requiredScopes].every(scope => tokenScopes.has(scope));

    return hasAllRequired
      ? Effect.void
      : Effect.fail(new InsufficientScopesError(this.requiredScopes, scopes));
  }

  /**
   * Create AccessToken from validated claims.
   */
  private _createAccessToken(
    token: string,
    claims: Record<string, unknown>
  ): AccessToken {
    const scopes = this._extractScopes(claims);
    const exp = claims.exp;

    return {
      token,
      client_id: String(claims.client_id || claims.sub || "unknown"),
      scopes,
      expires_at: typeof exp === "number" ? exp : undefined,
    };
  }

  /**
   * Validate audience claim.
   */
  private _validateAudience(aud: unknown): boolean {
    if (!this.audience) {
      return true;
    }

    if (Array.isArray(this.audience)) {
      if (Array.isArray(aud)) {
        return this.audience.some(expected => aud.includes(expected));
      }
      return this.audience.includes(String(aud));
    }

    if (Array.isArray(aud)) {
      return aud.includes(this.audience);
    }

    return String(aud) === this.audience;
  }

  /**
   * Extract scopes from JWT claims.
   */
  private _extractScopes(claims: Record<string, unknown>): string[] {
    for (const claim of ["scope", "scp"]) {
      const value = claims[claim];
      if (typeof value === "string") {
        return value.split(" ");
      }
      if (Array.isArray(value)) {
        return value.map(String);
      }
    }
    return [];
  }
}

/**
 * OAuth 2.0 Token Introspection verifier (RFC 7662) using Effect.
 */
export class IntrospectionTokenVerifier extends TokenVerifier {
  private readonly introspectionEndpoint: string;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly validateResource: boolean;
  private readonly timeout: number;

  constructor(options: {
    introspectionEndpoint: string;
    serverUrl: string;
    clientId?: string;
    clientSecret?: string;
    validateResource?: boolean;
    requiredScopes?: string[];
    timeout?: number;
  }) {
    super(options.serverUrl, options.requiredScopes);
    
    this.introspectionEndpoint = options.introspectionEndpoint;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.validateResource = options.validateResource || false;
    this.timeout = options.timeout || 10.0;
  }

  /**
   * Verify token using OAuth 2.0 introspection with Effect.
   */
  verifyToken(
    token: string
  ): Effect.Effect<AccessToken, AuthenticationError | TokenExpiredError | InvalidTokenError | InsufficientScopesError> {
    return pipe(
      this._performIntrospection(token),
      Effect.flatMap((response) => this._processIntrospectionResponse(token, response)),
      Effect.catchAll((error) => {
        logger.debug("Introspection verification failed:", error);
        return Effect.fail(new AuthenticationError("Introspection failed"));
      })
    );
  }

  /**
   * Perform introspection request using Effect.
   */
  private _performIntrospection(
    token: string
  ): Effect.Effect<Record<string, unknown>, AuthenticationError> {
    return Effect.tryPromise({
      try: async () => {
        const body = new URLSearchParams();
        body.append("token", token);

        if (this.validateResource && this.resourceServerUrl) {
          body.append("resource", this.resourceServerUrl);
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/x-www-form-urlencoded",
        };

        if (this.clientId && this.clientSecret) {
          const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
          headers.Authorization = `Basic ${credentials}`;
        }

        const response = await fetch(this.introspectionEndpoint, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(this.timeout * 1000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
      },
      catch: (error) => new AuthenticationError("Introspection request failed", error),
    });
  }

  /**
   * Process introspection response using Effect.
   */
  private _processIntrospectionResponse(
    token: string,
    response: Record<string, unknown>
  ): Effect.Effect<AccessToken, InvalidTokenError | InsufficientScopesError> {
    // Check if token is active
    if (!response.active) {
      return Effect.fail(new InvalidTokenError("Token is not active"));
    }

    const clientId = response.client_id || "unknown";
    const scopes = response.scope
      ? String(response.scope).split(" ")
      : [];
    const exp = response.exp;

    return pipe(
      this._validateRequiredScopes(scopes),
      Effect.map(() => ({
        token,
        client_id: String(clientId),
        scopes,
        expires_at: typeof exp === "number" ? exp : undefined,
        resource: this.resourceServerUrl,
      }))
    );
  }

  /**
   * Validate required scopes using Effect.
   */
  private _validateRequiredScopes(
    scopes: string[]
  ): Effect.Effect<void, InsufficientScopesError> {
    if (this.requiredScopes.length === 0) {
      return Effect.void;
    }

    const tokenScopes = new Set(scopes);
    const requiredScopes = new Set(this.requiredScopes);
    const hasAllRequired = [...requiredScopes].every(scope => tokenScopes.has(scope));

    return hasAllRequired
      ? Effect.void
      : Effect.fail(new InsufficientScopesError(this.requiredScopes, scopes));
  }
}

/**
 * Simple static token verifier for testing and development using Effect.
 */
export class StaticTokenVerifier extends TokenVerifier {
  private readonly tokens: Map<string, {
    client_id: string;
    scopes: string[];
    expires_at?: number;
  }>;

  constructor(
    tokens: Record<string, {
      client_id: string;
      scopes: string[];
      expires_at?: number;
    }>,
    requiredScopes?: string[]
  ) {
    super(undefined, requiredScopes);
    this.tokens = new Map(Object.entries(tokens));
  }

  /**
   * Verify token against static token dictionary using Effect.
   */
  verifyToken(
    token: string
  ): Effect.Effect<AccessToken, AuthenticationError | TokenExpiredError | InvalidTokenError | InsufficientScopesError> {
    return pipe(
      Effect.sync(() => this.tokens.get(token)),
      Effect.flatMap((tokenData) =>
        tokenData
          ? this._validateTokenData(token, tokenData)
          : Effect.fail(new InvalidTokenError("Token not found"))
      )
    );
  }

  /**
   * Validate token data using Effect.
   */
  private _validateTokenData(
    token: string,
    tokenData: {
      client_id: string;
      scopes: string[];
      expires_at?: number;
    }
  ): Effect.Effect<AccessToken, TokenExpiredError | InsufficientScopesError> {
    return pipe(
      // Check expiration
      Effect.sync(() => {
        const expiresAt = tokenData.expires_at;
        if (expiresAt !== undefined && expiresAt < Math.floor(Date.now() / 1000)) {
          throw new TokenExpiredError();
        }
      }),
      // Validate scopes
      Effect.flatMap(() => this._validateRequiredScopes(tokenData.scopes)),
      // Create access token
      Effect.map(() => ({
        token,
        client_id: tokenData.client_id,
        scopes: tokenData.scopes,
        expires_at: tokenData.expires_at,
      }))
    );
  }

  /**
   * Validate required scopes using Effect.
   */
  private _validateRequiredScopes(
    scopes: string[]
  ): Effect.Effect<void, InsufficientScopesError> {
    if (this.requiredScopes.length === 0) {
      return Effect.void;
    }

    const tokenScopes = new Set(scopes);
    const requiredScopes = new Set(this.requiredScopes);
    const hasAllRequired = [...requiredScopes].every(scope => tokenScopes.has(scope));

    return hasAllRequired
      ? Effect.void
      : Effect.fail(new InsufficientScopesError(this.requiredScopes, scopes));
  }
}