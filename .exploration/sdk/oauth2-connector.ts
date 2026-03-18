import { CustomApp } from './app-types';

/**
 * OAuth2 Connector system for handling OAuth2 flows
 */

// Core OAuth2 types
export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  [key: string]: any; // Allow additional fields
}

export interface OAuth2AuthRequest {
  url: string;
  state: string;
}

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes?: string[];
  redirectUri?: string; // Platform will generate if not provided
}

// Extensible OAuth2 connector
export class OAuth2Connector {
  protected config: OAuth2Config;
  protected customApp: CustomApp;

  constructor(customApp: CustomApp, config: OAuth2Config) {
    this.customApp = customApp;
    this.config = config;
  }

  /**
   * Get the redirect URI for this custom app
   * Default implementation uses platform standard
   */
  getRedirectUri(): string {
    return this.config.redirectUri || 
      `https://platform.unscrambled.ai/oauth/callback/${this.customApp.name}`;
  }

  /**
   * Build authorization URL with all parameters
   * Override to customize parameters
   */
  buildAuthorizationUrl(state: string): OAuth2AuthRequest {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.getRedirectUri(),
      response_type: 'code',
      state: state,
      ...this.getAdditionalAuthParams()
    });

    if (this.config.scopes && this.config.scopes.length > 0) {
      params.set('scope', this.formatScopes(this.config.scopes));
    }

    return {
      url: `${this.config.authorizationUrl}?${params.toString()}`,
      state
    };
  }

  /**
   * Override to add custom authorization parameters
   */
  protected getAdditionalAuthParams(): Record<string, string> {
    return {};
  }

  /**
   * Override to customize scope formatting
   * Default is space-separated
   */
  protected formatScopes(scopes: string[]): string {
    return scopes.join(' ');
  }

  /**
   * Exchange authorization code for access token
   * Override to handle non-standard responses
   */
  async exchangeCodeForToken(code: string): Promise<OAuth2TokenResponse> {
    const body = {
      grant_type: 'authorization_code',
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.getRedirectUri(),
      ...this.getAdditionalTokenParams()
    };

    const response = await this.makeTokenRequest(body);
    return this.processTokenResponse(response);
  }

  /**
   * Refresh access token using refresh token
   * Override to handle non-standard refresh flows
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuth2TokenResponse> {
    const body = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      ...this.getAdditionalRefreshParams()
    };

    const response = await this.makeTokenRequest(body);
    return this.processTokenResponse(response);
  }

  /**
   * Override to add custom token exchange parameters
   */
  protected getAdditionalTokenParams(): Record<string, string> {
    return {};
  }

  /**
   * Override to add custom refresh parameters
   */
  protected getAdditionalRefreshParams(): Record<string, string> {
    return {};
  }

  /**
   * Make the actual HTTP request for tokens
   * Override to customize headers or request format
   */
  protected async makeTokenRequest(body: Record<string, string>): Promise<any> {
    // This would use the platform's HTTP client
    // Placeholder for the actual implementation
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...this.getAdditionalHeaders()
    };

    // Platform will provide the actual HTTP implementation
    throw new Error('Platform HTTP client required');
  }

  /**
   * Override to add custom headers
   */
  protected getAdditionalHeaders(): Record<string, string> {
    return {};
  }

  /**
   * Process the token response
   * Override to handle non-standard response formats
   */
  protected processTokenResponse(response: any): OAuth2TokenResponse {
    // Default implementation assumes standard OAuth2 response
    return response;
  }

  /**
   * Calculate token expiration time
   * Override for non-standard expires_in handling
   */
  calculateExpiresAt(tokenResponse: OAuth2TokenResponse): Date | null {
    if (!tokenResponse.expires_in) {
      return null;
    }
    
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);
    return expiresAt;
  }
}

// Builder for OAuth2 connector configuration
export class OAuth2ConnectorBuilder {
  private customApp: CustomApp;
  private config: Partial<OAuth2Config> = {};
  private connectorClass: typeof OAuth2Connector = OAuth2Connector;

  constructor(customApp: CustomApp) {
    this.customApp = customApp;
  }

  withClientCredentials(clientId: string, clientSecret: string): this {
    this.config.clientId = clientId;
    this.config.clientSecret = clientSecret;
    return this;
  }

  withEndpoints(authorizationUrl: string, tokenUrl: string): this {
    this.config.authorizationUrl = authorizationUrl;
    this.config.tokenUrl = tokenUrl;
    return this;
  }

  withScopes(...scopes: string[]): this {
    this.config.scopes = scopes;
    return this;
  }

  withRedirectUri(redirectUri: string): this {
    this.config.redirectUri = redirectUri;
    return this;
  }

  /**
   * Use a custom connector class for advanced customization
   */
  withConnectorClass(connectorClass: typeof OAuth2Connector): this {
    this.connectorClass = connectorClass;
    return this;
  }

  build(): OAuth2Connector {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('Client credentials are required');
    }
    if (!this.config.authorizationUrl || !this.config.tokenUrl) {
      throw new Error('Authorization and token URLs are required');
    }

    return new this.connectorClass(this.customApp, this.config as OAuth2Config);
  }
}

export function defineOAuth2Connector(customApp: CustomApp): OAuth2ConnectorBuilder {
  return new OAuth2ConnectorBuilder(customApp);
}