import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { httpRequest, HttpProxyResponseError, isHttpProxyResponseError } from "./index";

// Mock fetch globally
global.fetch = vi.fn();

describe("httpRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LIGHTYEAR_API_KEY = "test-api-key";
    process.env.ENV_NAME = "test";
    process.env.BASE_URL = "https://test.runlightyear.com";
  });

  afterEach(() => {
    delete process.env.LIGHTYEAR_API_KEY;
    delete process.env.ENV_NAME;
    delete process.env.BASE_URL;
  });

  describe("redactKeys behavior", () => {
    it("should NOT modify proxyResponse.data when creating dataForLogging for errors", async () => {
      // This is the critical test - simulates an OAuth error response that contains tokens
      // The dataForLogging should have [REDACTED] but proxyResponse.data should be unchanged
      const mockOAuthErrorResponse = {
        access_token: "real_access_token_value",
        refresh_token: "real_refresh_token_value",
        error: "invalid_grant",
        error_description: "Token has been revoked",
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            status: 400, // OAuth provider returned 400
            statusText: "Bad Request",
            headers: { "content-type": "application/json" },
            data: mockOAuthErrorResponse,
          }),
      });

      // Capture what gets logged
      const errorLogs: string[] = [];
      const originalConsoleError = console.error;
      console.error = (...args: any[]) => {
        errorLogs.push(args.map(String).join(" "));
      };

      try {
        await httpRequest({
          method: "POST",
          url: "https://oauth.example.com/token",
          redactKeys: ["access_token", "refresh_token"],
        });
        // Should throw because status is 400
        expect.fail("Should have thrown HttpProxyResponseError");
      } catch (error) {
        // Restore console.error before assertions
        console.error = originalConsoleError;

        // Verify it's the right error type
        expect(isHttpProxyResponseError(error)).toBe(true);
        const httpError = error as HttpProxyResponseError;

        // CRITICAL: The response.data should have the ORIGINAL values, not [REDACTED]
        expect(httpError.response.data.access_token).toBe(
          "real_access_token_value"
        );
        expect(httpError.response.data.refresh_token).toBe(
          "real_refresh_token_value"
        );

        // The LOGGED output should have [REDACTED] (verify the logging worked)
        const loggedResponse = errorLogs.find((log) =>
          log.includes("[REDACTED]")
        );
        expect(loggedResponse).toBeDefined();

        // But the actual response data must NOT contain [REDACTED]
        expect(httpError.response.data.access_token).not.toBe("[REDACTED]");
        expect(httpError.response.data.refresh_token).not.toBe("[REDACTED]");
      }
    });

    it("should return unchanged data on successful response with redactKeys", async () => {
      // Simulates successful OAuth token response
      const mockOAuthSuccessResponse = {
        access_token: "new_access_token_12345",
        refresh_token: "new_refresh_token_67890",
        token_type: "Bearer",
        expires_in: 3600,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            status: 200,
            statusText: "OK",
            headers: { "content-type": "application/json" },
            data: mockOAuthSuccessResponse,
          }),
      });

      const response = await httpRequest({
        method: "POST",
        url: "https://oauth.example.com/token",
        redactKeys: ["access_token", "refresh_token"],
      });

      // CRITICAL: The response data should have the ORIGINAL values
      expect(response.data.access_token).toBe("new_access_token_12345");
      expect(response.data.refresh_token).toBe("new_refresh_token_67890");
      expect(response.data.token_type).toBe("Bearer");
      expect(response.data.expires_in).toBe(3600);

      // Verify no [REDACTED] contamination
      expect(response.data.access_token).not.toBe("[REDACTED]");
      expect(response.data.refresh_token).not.toBe("[REDACTED]");
    });

    it("should not mutate the original response data object", async () => {
      const originalData = {
        access_token: "original_token",
        refresh_token: "original_refresh",
        other_field: "unchanged",
      };

      // Create a reference to track mutations
      const dataReference = { ...originalData };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            status: 400, // Error response to trigger dataForLogging
            statusText: "Bad Request",
            headers: {},
            data: originalData,
          }),
      });

      // Suppress console.error for this test
      const originalConsoleError = console.error;
      console.error = () => {};

      try {
        await httpRequest({
          method: "POST",
          url: "https://api.example.com/test",
          redactKeys: ["access_token", "refresh_token"],
        });
      } catch (error) {
        console.error = originalConsoleError;

        // The original data object should NOT have been mutated
        expect(originalData.access_token).toBe(dataReference.access_token);
        expect(originalData.refresh_token).toBe(dataReference.refresh_token);
        expect(originalData.other_field).toBe(dataReference.other_field);

        // Specifically check that [REDACTED] didn't get written to the original
        expect(originalData.access_token).not.toBe("[REDACTED]");
        expect(originalData.refresh_token).not.toBe("[REDACTED]");
      }
    });

    it("should handle empty redactKeys without issues", async () => {
      const mockData = {
        access_token: "token_value",
        refresh_token: "refresh_value",
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            status: 200,
            statusText: "OK",
            headers: {},
            data: mockData,
          }),
      });

      const response = await httpRequest({
        method: "GET",
        url: "https://api.example.com/test",
        redactKeys: [], // Empty array
      });

      expect(response.data.access_token).toBe("token_value");
      expect(response.data.refresh_token).toBe("refresh_value");
    });

    it("should handle undefined redactKeys without issues", async () => {
      const mockData = {
        access_token: "token_value",
        refresh_token: "refresh_value",
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            status: 200,
            statusText: "OK",
            headers: {},
            data: mockData,
          }),
      });

      const response = await httpRequest({
        method: "GET",
        url: "https://api.example.com/test",
        // No redactKeys specified
      });

      expect(response.data.access_token).toBe("token_value");
      expect(response.data.refresh_token).toBe("refresh_value");
    });

    it("should handle redactKeys when keys don't exist in response", async () => {
      const mockData = {
        some_other_field: "value",
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            status: 400,
            statusText: "Bad Request",
            headers: {},
            data: mockData,
          }),
      });

      const originalConsoleError = console.error;
      console.error = () => {};

      try {
        await httpRequest({
          method: "POST",
          url: "https://api.example.com/test",
          redactKeys: ["access_token", "refresh_token"], // These keys don't exist
        });
      } catch (error) {
        console.error = originalConsoleError;

        const httpError = error as HttpProxyResponseError;
        expect(httpError.response.data.some_other_field).toBe("value");
        // Should not have added [REDACTED] keys that didn't exist
        expect(httpError.response.data.access_token).toBeUndefined();
        expect(httpError.response.data.refresh_token).toBeUndefined();
      }
    });
  });

  describe("HttpProxyResponseError", () => {
    it("should preserve original response data in error", async () => {
      const sensitiveData = {
        access_token: "secret_token_abc123",
        refresh_token: "secret_refresh_xyz789",
        user_id: "12345",
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            status: 401,
            statusText: "Unauthorized",
            headers: { "www-authenticate": "Bearer" },
            data: sensitiveData,
          }),
      });

      const originalConsoleError = console.error;
      console.error = () => {};

      try {
        await httpRequest({
          method: "GET",
          url: "https://api.example.com/protected",
          redactKeys: ["access_token", "refresh_token"],
        });
        expect.fail("Should have thrown");
      } catch (error) {
        console.error = originalConsoleError;

        expect(isHttpProxyResponseError(error)).toBe(true);
        const httpError = error as HttpProxyResponseError;

        // The error response should contain the ORIGINAL sensitive data
        // so that callers can process it if needed
        expect(httpError.response.data.access_token).toBe("secret_token_abc123");
        expect(httpError.response.data.refresh_token).toBe(
          "secret_refresh_xyz789"
        );
        expect(httpError.response.data.user_id).toBe("12345");
      }
    });
  });
});

describe("dataForLogging isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LIGHTYEAR_API_KEY = "test-api-key";
    process.env.ENV_NAME = "test";
    process.env.BASE_URL = "https://test.runlightyear.com";
  });

  afterEach(() => {
    delete process.env.LIGHTYEAR_API_KEY;
    delete process.env.ENV_NAME;
    delete process.env.BASE_URL;
  });

  it("spread operator should create independent copy for dataForLogging", async () => {
    // This test verifies the JavaScript behavior we're relying on
    const originalData = {
      access_token: "real_token",
      refresh_token: "real_refresh",
      other: "value",
    };

    const redactKeys = ["access_token", "refresh_token"];

    // Simulate exactly what the code does
    const dataForLogging =
      redactKeys?.length &&
      originalData &&
      typeof originalData === "object" &&
      !Array.isArray(originalData)
        ? {
            ...(originalData as Record<string, unknown>),
            ...Object.fromEntries(
              redactKeys
                .filter((key) => key in (originalData as any))
                .map((key) => [key, "[REDACTED]"])
            ),
          }
        : originalData;

    // dataForLogging should have [REDACTED]
    expect(dataForLogging.access_token).toBe("[REDACTED]");
    expect(dataForLogging.refresh_token).toBe("[REDACTED]");
    expect(dataForLogging.other).toBe("value");

    // originalData should be UNCHANGED
    expect(originalData.access_token).toBe("real_token");
    expect(originalData.refresh_token).toBe("real_refresh");
    expect(originalData.other).toBe("value");
  });

  it("JSON.stringify should not mutate the object", async () => {
    const data = {
      access_token: "token123",
      refresh_token: "refresh456",
    };

    // Simulate what happens in the logging
    const jsonStr = JSON.stringify(data, null, 2);

    // Object should be unchanged after stringify
    expect(data.access_token).toBe("token123");
    expect(data.refresh_token).toBe("refresh456");

    // JSON string should contain the values
    expect(jsonStr).toContain("token123");
    expect(jsonStr).toContain("refresh456");
  });
});
