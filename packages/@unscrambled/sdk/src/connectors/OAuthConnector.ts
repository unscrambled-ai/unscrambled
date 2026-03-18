import { HttpProxyRequestProps, HttpProxyResponse, httpRequest } from "../http";
import { updateAuthData, AuthData as ApiAuthData } from "../utils/api";

/**
 * @public
 */
export interface OAuthConnectorProps {
  appName?: string;
  customAppName?: string;
  oauthConfigData: OAuthConfigData;
  authData?: AuthData;
  inDevelopment?: boolean;
  proxied?: boolean;
  baseUrls?: OAuthConnectorBaseUrls;
}

/**
 * @public
 */
export interface OAuthConfigData {
  clientId: string | null;
  clientSecret: string | null;
  authRequestUrl?: string | null;
}

/**
 * @public
 */
export interface OAuthConnectorBaseUrls {
  authRequestUrl?: string;
  accessTokenUrl?: string;
  refreshTokenUrl?: string;
}

/**
 * @public
 */
export interface AuthData {
  appName?: string;
  customAppName?: string;
  managedUser?: string;
  authName?: string;
  tokenType?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  refreshedAt?: string;
  apiKey?: string | null;
  username?: string | null;
  password?: string | null;
  state?: string;
}

export interface OAuthConnectorRequestAccessTokenHeaders {
  [name: string]: string;
}

export interface OAuthConnectorProcessRequestAccessTokenProps {
  status: number;
  statusText: string;
  headers: OAuthConnectorRequestAccessTokenHeaders;
  text: string;
}

export interface OAuthConnectorProcessRefreshAccessTokenProps
  extends OAuthConnectorProcessRequestAccessTokenProps {}

/**
 * @public
 *
 * OAuth2 Connector for SDK
 *
 * Creates the input to the 3 essential OAuth tasks:
 *
 * 1. Generates a url to request an access token
 * 2. Converts the oauth callback parameters into the https call to request an access token
 * 3. Provides the https params to refresh an access token
 */
export abstract class OAuthConnector {
  appName?: string;
  customAppName?: string;
  oauthConfigData: OAuthConfigData;
  authData?: AuthData;
  inDevelopment?: boolean;
  proxied?: boolean;
  baseUrls?: OAuthConnectorBaseUrls;

  constructor(props: OAuthConnectorProps) {
    const {
      oauthConfigData,
      appName,
      customAppName,
      authData,
      inDevelopment = false,
      proxied = true,
      baseUrls,
    } = props;

    this.oauthConfigData = oauthConfigData;
    this.baseUrls = baseUrls;

    this.appName = appName;
    this.customAppName = customAppName;
    this.authData = authData;
    this.inDevelopment = inDevelopment;
    this.proxied = proxied;
  }

  /**
   * Return the set of available scopes supported by this connector (if any)
   */
  getAvailableScopes(): string[] {
    return [];
  }

  /**
   * Validate that client credentials are available for operations that need them
   */
  private validateClientCredentials(): void {
    const { clientId, clientSecret } = this.oauthConfigData;

    if (this.appName) {
      if (!clientId) throw new Error("Client ID not set");
      if (!clientSecret) throw new Error("Client secret not set");
    }

    if (!clientId || !clientSecret) {
      console.error(
        `Custom app ${this.customAppName} is missing client id and/or client secret. Configure at https://app.runlightyear.com/envs/<envName>/custom-apps/${this.customAppName}`
      );
      throw new Error("Custom app client id and/or client secret not set");
    }
  }

  /**
   * Get the base URL for auth request. Can be overridden by baseUrls.authRequestUrl
   */
  abstract getAuthRequestUrlBase(): string;

  /**
   * Get the final auth request URL base, preferring configured baseUrls
   */
  private getConfiguredAuthRequestUrlBase(): string {
    return this.baseUrls?.authRequestUrl || this.getAuthRequestUrlBase();
  }

  getAuthRequestUrlParams(): Record<string, string> {
    if (!this.authData) throw new Error("Missing authData");

    const { clientId } = this.oauthConfigData;
    if (!clientId) throw new Error("Client ID not set");

    const { state } = this.authData;
    if (!state) throw new Error("Missing state");

    return {
      response_type: "code",
      client_id: clientId,
      redirect_uri: this.getRedirectUri(),
      state,
    };
  }

  getAuthRequestUrl(): string {
    const base = this.getConfiguredAuthRequestUrlBase();
    if (!base) throw new Error("Missing authRequestUrlBase");

    console.info("🔐 Generating OAuth Authorization URL");
    console.info("=====================================");

    const params = this.getAuthRequestUrlParams();
    const url = new URL(`${base}?${new URLSearchParams(params)}`);

    // Enhanced logging with parameter breakdown
    console.info("📍 Base Authorization URL:");
    console.info(`   ${base}`);
    console.info("");

    console.info("🔧 OAuth Parameters:");
    Object.entries(params).forEach(([key, value]) => {
      if (key === "scope") {
        console.info(`   ${key}: ${value}`);
        // Show scope breakdown if it contains multiple scopes
        const scopes = value.split(/[\s,+]/).filter((s) => s.length > 0);
        if (scopes.length > 1) {
          console.info(`   └── Scopes (${scopes.length}):`);
          scopes.forEach((scope, index) => {
            console.info(`       ${index + 1}. ${scope}`);
          });
        }
      } else if (key === "client_id") {
        // Redact client ID for security, show only first/last few chars
        const redacted =
          value.length > 8
            ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
            : "[REDACTED]";
        console.info(`   ${key}: ${redacted}`);
      } else {
        console.info(`   ${key}: ${value}`);
      }
    });
    console.info("");

    console.info("🌐 Complete Authorization URL:");
    console.info(`   ${url.href}`);
    console.info("");

    console.info("✅ OAuth authorization URL generated successfully!");

    return url.href;
  }

  /**
   * Get the url of the access token endpoint.
   */
  abstract getAccessTokenUrl(): string;

  /**
   * Get the final access token URL, preferring configured baseUrls
   */
  private getConfiguredAccessTokenUrl(): string {
    return this.baseUrls?.accessTokenUrl || this.getAccessTokenUrl();
  }

  /**
   * Get the url of the refresh token endpoint
   *
   * By default, returns the same url as the access token endpoint
   */
  getRefreshTokenUrl(): string {
    return this.baseUrls?.refreshTokenUrl || this.getConfiguredAccessTokenUrl();
  }

  getRedirectUri(): string {
    const suffix =
      this.inDevelopment || process.env.NODE_ENV === "development"
        ? "-local"
        : "";

    return `https://app.runlightyear.com/oauth2/callback${suffix}`;
  }

  getRequestAccessTokenHeaders(): OAuthConnectorRequestAccessTokenHeaders {
    return {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    };
  }

  getRequestAccessTokenParams(code: string): Record<string, string> {
    if (!code) throw new Error("Missing code");
    if (!this.authData) throw new Error("Missing authData");

    const { state } = this.authData;
    if (!state) throw new Error("Missing state");

    const { clientId, clientSecret } = this.oauthConfigData;
    if (!clientId) throw new Error("Missing clientId");
    if (!clientSecret) throw new Error("Missing clientSecret");

    return {
      grant_type: "authorization_code",
      code,
      state,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: this.getRedirectUri(),
    };
  }

  getRequestAccessTokenBody(code: string): string {
    const rawParams = this.getRequestAccessTokenParams(code);

    const params = new URLSearchParams();
    Object.entries(rawParams).forEach((nameValuePair) => {
      params.append(nameValuePair[0], nameValuePair[1]);
    });

    return params.toString();
  }

  getRequestAccessTokenRedactKeys() {
    return ["access_token", "refresh_token"];
  }

  /**
   * Extract custom fields from the OAuth token response to store in extraData
   * Override this method to specify which fields from the response should be stored
   * @param data - The parsed JSON response from the OAuth token endpoint
   * @returns An object containing the fields to store in extraData, or undefined
   */
  protected extractExtraData(
    data: Record<string, any>
  ): Record<string, any> | undefined {
    return undefined;
  }

  /**
   * Calculate the expiration time for the access token
   * Override this method to customize expiration calculation based on the response
   * @param data - The parsed JSON response from the OAuth token endpoint
   * @returns ISO string of expiration date/time, or undefined if no expiration
   */
  protected calculateExpiresAt(data: Record<string, any>): string | undefined {
    const expiresIn = data["expires_in"];
    if (expiresIn) {
      const expiryDate = new Date(Date.now() + parseInt(expiresIn) * 1000);
      return expiryDate.toISOString();
    }
    return undefined;
  }

  processRequestAccessTokenResponse(
    props: OAuthConnectorProcessRequestAccessTokenProps
  ): AuthData {
    const { status, statusText, headers, text } = props;

    if (status >= 300) {
      console.error(text);
      throw new Error(`Request access token failed: ${status} ${statusText}`);
    }

    console.debug("status", status);
    const data = JSON.parse(text);

    const { appName, customAppName, managedUser, authName } = data;

    const tokenType = data["token_type"];
    const accessToken = data["access_token"];
    const refreshToken = data["refresh_token"];

    const expiresAt = this.calculateExpiresAt(data);
    const extraData = this.extractExtraData(data);

    return {
      appName,
      customAppName,
      managedUser,
      authName,
      tokenType,
      accessToken,
      refreshToken,
      expiresAt,
      apiKey: null,
      username: null,
      password: null,
      ...(extraData ? { extraData } : {}),
    };
  }

  getRefreshAccessTokenHeaders() {
    return this.getRequestAccessTokenHeaders();
  }

  getRefreshAccessTokenBody(): string {
    const { clientId, clientSecret } = this.oauthConfigData;
    if (!clientId) throw new Error("Missing clientId");
    if (!clientSecret) throw new Error("Missing clientSecret");

    if (!this.authData) throw new Error("Missing authData");
    const { refreshToken } = this.authData;
    if (!refreshToken) throw new Error("Missing refreshToken");

    const params = new URLSearchParams();
    params.append("refresh_token", refreshToken);
    params.append("grant_type", "refresh_token");
    params.append("client_id", clientId);
    params.append("client_secret", clientSecret);

    return params.toString();
  }

  getRefreshAccessTokenRedactKeys() {
    return this.getRequestAccessTokenRedactKeys();
  }

  processRefreshAccessTokenResponse(
    props: OAuthConnectorProcessRefreshAccessTokenProps
  ): AuthData {
    const { status, statusText, headers, text } = props;

    const authData = this.processRequestAccessTokenResponse({
      status,
      statusText,
      headers,
      text,
    });
    const refreshedAt = new Date().toISOString();
    return { ...authData, refreshedAt };
  }

  buildUrl(url: string, params?: Record<string, any>) {
    if (!params) return url;

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    const queryStr = searchParams.toString();
    return queryStr ? `${url}?${queryStr}` : url;
  }

  /**
   * Make a proxied http request
   */
  async request(props: HttpProxyRequestProps): Promise<HttpProxyResponse> {
    console.debug("in OAuthConnector.request");
    const { method, url, params, headers, data, body, redactKeys, json } =
      props as any;

    const proxyProps = {
      method,
      url: this.buildUrl(url, params),
      headers: {
        ...headers,
      },
      body:
        body ??
        (json !== undefined ? JSON.stringify(json) : undefined) ??
        (data ? JSON.stringify(data) : undefined),
      redactKeys,
    };

    let response: HttpProxyResponse;

    if (this.proxied) {
      response = await httpRequest(proxyProps);
    } else {
      console.error("Only proxying supported for now...");
      throw new Error("Only proxying supported for now...");
    }

    return { ...response, data: response.data };
  }

  async post(props: HttpProxyRequestProps) {
    return await this.request({ ...props, method: "POST" });
  }

  async requestAccessToken(code: string): Promise<AuthData> {
    console.info("🔄 Starting OAuth access token exchange");
    console.info("=======================================");
    console.info(`📱 Custom App: ${this.customAppName || this.appName}`);
    console.info(`🔑 Auth Name: ${this.authData?.authName}`);
    console.info(
      `📝 Authorization Code: ${code.substring(0, 10)}...${code.substring(
        code.length - 4
      )}`
    );
    console.info("");

    const url = this.getConfiguredAccessTokenUrl();
    const headers = this.getRequestAccessTokenHeaders();
    const body = this.getRequestAccessTokenBody(code);
    const redactKeys = this.getRequestAccessTokenRedactKeys();

    console.info("🌐 Token Exchange Request Details:");
    console.info(`   URL: ${url}`);
    console.info(`   Method: POST`);
    console.info("   Headers:");
    Object.entries(headers).forEach(([key, value]) => {
      console.info(`     ${key}: ${value}`);
    });
    console.info("   Body Parameters:");
    const bodyParams = new URLSearchParams(body);
    for (const [key, value] of bodyParams.entries()) {
      if (key === "client_secret" || key === "code") {
        const redacted =
          value.length > 8
            ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
            : "[REDACTED]";
        console.info(`     ${key}: ${redacted}`);
      } else {
        console.info(`     ${key}: ${value}`);
      }
    }
    console.info("");

    console.info("📡 Making token exchange request...");
    const response = await this.post({
      url,
      headers,
      body,
      redactKeys,
    });

    console.info("📥 Token Exchange Response:");
    console.info(`   Status: ${response.status} ${response.statusText}`);
    console.info(
      `   Success: ${
        response.status >= 200 && response.status < 300 ? "✅" : "❌"
      }`
    );
    console.info("   Response Headers:");
    Object.entries(response.headers || {}).forEach(([key, value]) => {
      console.info(`     ${key}: ${value}`);
    });

    if (response.data) {
      console.info("   Response Data Structure:");
      const dataKeys = Object.keys(response.data);
      dataKeys.forEach((key) => {
        if (key.includes("token") || key.includes("secret")) {
          console.info(`     ${key}: [PRESENT - REDACTED]`);
        } else {
          console.info(`     ${key}: ${response.data[key]}`);
        }
      });
    }
    console.info("");

    console.info("🔧 Processing token response...");
    const newAuthData = this.processRequestAccessTokenResponse({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      text: JSON.stringify(response.data),
    });

    console.info("✅ Token processing complete!");
    console.info(`   Token Type: ${newAuthData.tokenType || "Bearer"}`);
    console.info(
      `   Access Token: ${newAuthData.accessToken ? "RECEIVED" : "MISSING"}`
    );
    console.info(
      `   Refresh Token: ${newAuthData.refreshToken ? "RECEIVED" : "MISSING"}`
    );
    console.info(`   Expires At: ${newAuthData.expiresAt || "Not specified"}`);
    console.info("");

    // Save the new auth data to the platform
    const authName = this.authData?.authName;
    if (!authName) throw new Error("Need an auth name");

    console.info("💾 Saving tokens to platform...");

    // Filter auth data to only include fields accepted by the platform
    const platformAuthData = {
      appName: newAuthData.appName,
      customAppName: newAuthData.customAppName,
      managedUser: newAuthData.managedUser,
      authName: newAuthData.authName,
      accessToken: newAuthData.accessToken,
      refreshToken: newAuthData.refreshToken,
      expiresAt: newAuthData.expiresAt,
      state: (newAuthData as any).state,
      codeVerifier: (newAuthData as any).codeVerifier,
      extraData: (newAuthData as any).extraData,
      // Exclude: tokenType, apiKey, username, password, refreshedAt (not accepted by platform)
    };

    await updateAuthData({
      appName: this.appName,
      customAppName: this.customAppName,
      authName,
      authData: platformAuthData as unknown as ApiAuthData,
    });

    console.info("🎉 OAuth Access Token Exchange Complete!");
    console.info("========================================");
    console.info("✅ Access token received and saved successfully");
    console.info("✅ OAuth flow ready for API requests");
    console.info("");

    return newAuthData;
  }

  async refreshAccessToken(): Promise<AuthData> {
    console.info("🔄 Starting OAuth access token refresh");
    console.info("======================================");
    console.info(`📱 Custom App: ${this.customAppName || this.appName}`);
    console.info(`🔑 Auth Name: ${this.authData?.authName}`);
    console.info(
      `🔄 Current Token Expires: ${this.authData?.expiresAt || "Unknown"}`
    );
    console.info(
      `🕐 Current Token Refreshed: ${this.authData?.refreshedAt || "Never"}`
    );
    console.info("");

    const url = this.getRefreshTokenUrl();
    const headers = this.getRefreshAccessTokenHeaders();
    const body = this.getRefreshAccessTokenBody();
    const redactKeys = this.getRefreshAccessTokenRedactKeys();

    console.info("🌐 Token Refresh Request Details:");
    console.info(`   URL: ${url}`);
    console.info(`   Method: POST`);
    console.info("   Headers:");
    Object.entries(headers).forEach(([key, value]) => {
      console.info(`     ${key}: ${value}`);
    });
    console.info("   Body Parameters:");
    const bodyParams = new URLSearchParams(body);
    for (const [key, value] of bodyParams.entries()) {
      if (key === "client_secret" || key === "refresh_token") {
        const redacted =
          value.length > 8
            ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
            : "[REDACTED]";
        console.info(`     ${key}: ${redacted}`);
      } else {
        console.info(`     ${key}: ${value}`);
      }
    }
    console.info("");

    console.info("📡 Making token refresh request...");
    const response = await this.post({ url, headers, body, redactKeys });

    console.info("📥 Token Refresh Response:");
    console.info(`   Status: ${response.status} ${response.statusText}`);
    console.info(
      `   Success: ${
        response.status >= 200 && response.status < 300 ? "✅" : "❌"
      }`
    );
    console.info("   Response Headers:");
    Object.entries(response.headers || {}).forEach(([key, value]) => {
      console.info(`     ${key}: ${value}`);
    });

    if (response.data) {
      console.info("   Response Data Structure:");
      const dataKeys = Object.keys(response.data);
      dataKeys.forEach((key) => {
        if (key.includes("token") || key.includes("secret")) {
          console.info(`     ${key}: [PRESENT - REDACTED]`);
        } else {
          console.info(`     ${key}: ${response.data[key]}`);
        }
      });
    }
    console.info("");

    console.info("🔧 Processing refresh response...");
    const newAuthData = this.processRefreshAccessTokenResponse({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      text: JSON.stringify(response.data),
    });

    console.info("✅ Token refresh processing complete!");
    console.info(`   Token Type: ${newAuthData.tokenType || "Bearer"}`);
    console.info(
      `   New Access Token: ${newAuthData.accessToken ? "RECEIVED" : "MISSING"}`
    );
    console.info(
      `   New Refresh Token: ${
        newAuthData.refreshToken ? "RECEIVED" : "MISSING"
      }`
    );
    console.info(
      `   New Expires At: ${newAuthData.expiresAt || "Not specified"}`
    );
    console.info(`   Refreshed At: ${newAuthData.refreshedAt || "Not set"}`);
    console.info("");

    // Save the refreshed auth data to the platform
    const authName = this.authData?.authName;
    if (!authName) throw new Error("Need an auth name");

    console.info("💾 Saving refreshed tokens to platform...");

    // Filter auth data to only include fields accepted by the platform
    const platformAuthData = {
      appName: newAuthData.appName,
      customAppName: newAuthData.customAppName,
      managedUser: newAuthData.managedUser,
      authName: newAuthData.authName,
      accessToken: newAuthData.accessToken,
      refreshToken: newAuthData.refreshToken,
      expiresAt: newAuthData.expiresAt,
      state: (newAuthData as any).state,
      codeVerifier: (newAuthData as any).codeVerifier,
      extraData: (newAuthData as any).extraData,
      // Exclude: tokenType, apiKey, username, password, refreshedAt (not accepted by platform)
    };

    await updateAuthData({
      appName: this.appName,
      customAppName: this.customAppName,
      authName,
      authData: platformAuthData as unknown as ApiAuthData,
    });

    console.info("🎉 OAuth Token Refresh Complete!");
    console.info("=================================");
    console.info("✅ Access token refreshed and saved successfully");
    console.info("✅ OAuth flow ready for continued API requests");
    console.info("");

    return newAuthData;
  }
}
