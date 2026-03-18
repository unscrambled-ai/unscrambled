import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OAuthConnector, AuthData } from "./OAuthConnector";

// Mock the http module
vi.mock("../http", () => ({
  httpRequest: vi.fn(),
}));

// Mock the api module
vi.mock("../utils/api", () => ({
  updateAuthData: vi.fn(),
}));

import { httpRequest } from "../http";
import { updateAuthData } from "../utils/api";

// Concrete implementation for testing
class TestOAuthConnector extends OAuthConnector {
  getAuthRequestUrlBase(): string {
    return "https://oauth.example.com/authorize";
  }

  getAccessTokenUrl(): string {
    return "https://oauth.example.com/token";
  }
}

describe("OAuthConnector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requestAccessToken", () => {
    it("should extract and pass real tokens to updateAuthData, not [REDACTED]", async () => {
      // Setup: OAuth provider returns real tokens
      const realAccessToken = "real_access_token_abc123xyz";
      const realRefreshToken = "real_refresh_token_def456uvw";

      (httpRequest as any).mockResolvedValue({
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        data: {
          access_token: realAccessToken,
          refresh_token: realRefreshToken,
          token_type: "Bearer",
          expires_in: 3600,
        },
      });

      (updateAuthData as any).mockResolvedValue(undefined);

      const connector = new TestOAuthConnector({
        oauthConfigData: {
          clientId: "test-client-id",
          clientSecret: "test-client-secret",
        },
        authData: {
          authName: "test-auth",
          state: "test-state",
        },
        customAppName: "test-app",
      });

      await connector.requestAccessToken("auth-code-123");

      // CRITICAL ASSERTION: updateAuthData should receive the REAL tokens
      expect(updateAuthData).toHaveBeenCalledTimes(1);
      const updateCall = (updateAuthData as any).mock.calls[0][0];

      // The authData passed to updateAuthData must have real tokens
      expect(updateCall.authData.accessToken).toBe(realAccessToken);
      expect(updateCall.authData.refreshToken).toBe(realRefreshToken);

      // Must NOT be [REDACTED]
      expect(updateCall.authData.accessToken).not.toBe("[REDACTED]");
      expect(updateCall.authData.refreshToken).not.toBe("[REDACTED]");
    });

    it("should pass correct redactKeys to httpRequest", async () => {
      (httpRequest as any).mockResolvedValue({
        status: 200,
        statusText: "OK",
        headers: {},
        data: {
          access_token: "token",
          refresh_token: "refresh",
          token_type: "Bearer",
        },
      });

      (updateAuthData as any).mockResolvedValue(undefined);

      const connector = new TestOAuthConnector({
        oauthConfigData: {
          clientId: "client-id",
          clientSecret: "client-secret",
        },
        authData: {
          authName: "auth",
          state: "state",
        },
        customAppName: "app",
      });

      await connector.requestAccessToken("code");

      // Verify httpRequest was called with redactKeys
      expect(httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          redactKeys: ["access_token", "refresh_token"],
        })
      );
    });
  });

  describe("refreshAccessToken", () => {
    it("should extract and pass real tokens to updateAuthData, not [REDACTED]", async () => {
      const realAccessToken = "refreshed_access_token_new123";
      const realRefreshToken = "refreshed_refresh_token_new456";

      (httpRequest as any).mockResolvedValue({
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        data: {
          access_token: realAccessToken,
          refresh_token: realRefreshToken,
          token_type: "Bearer",
          expires_in: 3600,
        },
      });

      (updateAuthData as any).mockResolvedValue(undefined);

      const connector = new TestOAuthConnector({
        oauthConfigData: {
          clientId: "test-client-id",
          clientSecret: "test-client-secret",
        },
        authData: {
          authName: "test-auth",
          state: "test-state",
          refreshToken: "old_refresh_token", // Existing refresh token
        },
        customAppName: "test-app",
      });

      await connector.refreshAccessToken();

      // CRITICAL ASSERTION: updateAuthData should receive the REAL tokens
      expect(updateAuthData).toHaveBeenCalledTimes(1);
      const updateCall = (updateAuthData as any).mock.calls[0][0];

      expect(updateCall.authData.accessToken).toBe(realAccessToken);
      expect(updateCall.authData.refreshToken).toBe(realRefreshToken);

      // Must NOT be [REDACTED]
      expect(updateCall.authData.accessToken).not.toBe("[REDACTED]");
      expect(updateCall.authData.refreshToken).not.toBe("[REDACTED]");
    });

    it("should handle refresh when provider does not return new refresh token", async () => {
      // Some OAuth providers don't return a new refresh token on refresh
      const realAccessToken = "new_access_token";

      (httpRequest as any).mockResolvedValue({
        status: 200,
        statusText: "OK",
        headers: {},
        data: {
          access_token: realAccessToken,
          // NO refresh_token in response
          token_type: "Bearer",
          expires_in: 3600,
        },
      });

      (updateAuthData as any).mockResolvedValue(undefined);

      const connector = new TestOAuthConnector({
        oauthConfigData: {
          clientId: "client-id",
          clientSecret: "client-secret",
        },
        authData: {
          authName: "auth",
          state: "state",
          refreshToken: "existing_refresh_token",
        },
        customAppName: "app",
      });

      await connector.refreshAccessToken();

      const updateCall = (updateAuthData as any).mock.calls[0][0];

      // Access token should be the new one
      expect(updateCall.authData.accessToken).toBe(realAccessToken);

      // Refresh token should be undefined (not present in response)
      // NOT [REDACTED]
      expect(updateCall.authData.refreshToken).toBeUndefined();
      expect(updateCall.authData.refreshToken).not.toBe("[REDACTED]");
    });
  });

  describe("processRequestAccessTokenResponse", () => {
    it("should correctly extract tokens from response text", () => {
      const connector = new TestOAuthConnector({
        oauthConfigData: {
          clientId: "client-id",
          clientSecret: "client-secret",
        },
        authData: {
          authName: "auth",
          state: "state",
        },
        customAppName: "app",
      });

      const responseText = JSON.stringify({
        access_token: "extracted_access_token",
        refresh_token: "extracted_refresh_token",
        token_type: "Bearer",
        expires_in: 7200,
      });

      const result = connector.processRequestAccessTokenResponse({
        status: 200,
        statusText: "OK",
        headers: {},
        text: responseText,
      });

      expect(result.accessToken).toBe("extracted_access_token");
      expect(result.refreshToken).toBe("extracted_refresh_token");
      expect(result.tokenType).toBe("Bearer");

      // Verify no contamination
      expect(result.accessToken).not.toBe("[REDACTED]");
      expect(result.refreshToken).not.toBe("[REDACTED]");
    });

    it("should throw on error response status", () => {
      const connector = new TestOAuthConnector({
        oauthConfigData: {
          clientId: "client-id",
          clientSecret: "client-secret",
        },
        authData: {
          authName: "auth",
          state: "state",
        },
        customAppName: "app",
      });

      expect(() => {
        connector.processRequestAccessTokenResponse({
          status: 400,
          statusText: "Bad Request",
          headers: {},
          text: JSON.stringify({ error: "invalid_grant" }),
        });
      }).toThrow("Request access token failed: 400 Bad Request");
    });
  });

  describe("token flow integration", () => {
    it("should maintain token integrity through JSON stringify/parse cycle", async () => {
      // This tests the exact flow: response.data -> JSON.stringify -> JSON.parse -> extract tokens
      const originalToken = "token_with_special_chars_!@#$%";
      const originalRefresh = "refresh_with_unicode_\u00e9\u00e8";

      (httpRequest as any).mockResolvedValue({
        status: 200,
        statusText: "OK",
        headers: {},
        data: {
          access_token: originalToken,
          refresh_token: originalRefresh,
          token_type: "Bearer",
        },
      });

      (updateAuthData as any).mockResolvedValue(undefined);

      const connector = new TestOAuthConnector({
        oauthConfigData: {
          clientId: "client-id",
          clientSecret: "client-secret",
        },
        authData: {
          authName: "auth",
          state: "state",
        },
        customAppName: "app",
      });

      await connector.requestAccessToken("code");

      const updateCall = (updateAuthData as any).mock.calls[0][0];

      // Tokens should survive the JSON stringify/parse cycle intact
      expect(updateCall.authData.accessToken).toBe(originalToken);
      expect(updateCall.authData.refreshToken).toBe(originalRefresh);
    });

    it("should NOT have [REDACTED] appear anywhere in the token storage flow", async () => {
      // Comprehensive test: trace through entire flow
      let capturedHttpRequestCall: any = null;
      let capturedUpdateAuthDataCall: any = null;

      (httpRequest as any).mockImplementation(async (props: any) => {
        capturedHttpRequestCall = props;
        return {
          status: 200,
          statusText: "OK",
          headers: {},
          data: {
            access_token: "flow_test_access_token",
            refresh_token: "flow_test_refresh_token",
            token_type: "Bearer",
            expires_in: 3600,
          },
        };
      });

      (updateAuthData as any).mockImplementation(async (props: any) => {
        capturedUpdateAuthDataCall = props;
      });

      const connector = new TestOAuthConnector({
        oauthConfigData: {
          clientId: "client-id",
          clientSecret: "client-secret",
        },
        authData: {
          authName: "auth",
          state: "state",
        },
        customAppName: "app",
      });

      await connector.requestAccessToken("code");

      // Verify httpRequest was called with redactKeys (for logging purposes)
      expect(capturedHttpRequestCall.redactKeys).toContain("access_token");
      expect(capturedHttpRequestCall.redactKeys).toContain("refresh_token");

      // CRITICAL: Verify updateAuthData received real tokens
      expect(capturedUpdateAuthDataCall.authData.accessToken).toBe(
        "flow_test_access_token"
      );
      expect(capturedUpdateAuthDataCall.authData.refreshToken).toBe(
        "flow_test_refresh_token"
      );

      // Stringify the entire captured call and verify [REDACTED] doesn't appear
      const serialized = JSON.stringify(capturedUpdateAuthDataCall);
      expect(serialized).not.toContain("[REDACTED]");
    });
  });
});
