import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  LogCapture,
  initializeLogCapture,
  getLogCapture,
  setLogContext,
  clearLogContext,
  stopLogCapture,
} from "./logCapture";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("LogCapture", () => {
  let originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  };

  beforeEach(() => {
    // Store original console methods
    originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };

    // Clear any existing global log capture
    stopLogCapture();

    // Reset fetch mock
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
    });
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;

    // Stop log capture
    stopLogCapture();
  });

  describe("Basic log capture", () => {
    it("should capture and intercept console logs", () => {
      const logCapture = new LogCapture();

      logCapture.startCapture();

      console.log("Test message");

      expect(logCapture.getLogCount()).toBe(1);

      logCapture.stopCapture();
    });

    it("should capture different log levels", () => {
      const logCapture = new LogCapture();

      logCapture.startCapture();

      console.log("Log message");
      console.info("Info message");
      console.warn("Warn message");
      console.error("Error message");
      console.debug("Debug message");

      expect(logCapture.getLogCount()).toBe(5);

      logCapture.stopCapture();
    });

    it("should restore original console methods when stopped", () => {
      const logCapture = new LogCapture();

      logCapture.startCapture();
      const interceptedLog = console.log;

      logCapture.stopCapture();

      // Check that the methods are different (intercepted vs restored)
      expect(console.log).not.toBe(interceptedLog);

      // Test that the original functionality works
      expect(() => console.log("Test restoration")).not.toThrow();
    });

    it("should handle object logging", () => {
      const logCapture = new LogCapture();

      logCapture.startCapture();

      console.log("Message with object:", { key: "value", number: 42 });

      expect(logCapture.getLogCount()).toBe(1);

      logCapture.stopCapture();
    });
  });

  describe("Global log capture functions", () => {
    it("should initialize global log capture", () => {
      expect(getLogCapture()).toBeNull();

      initializeLogCapture();

      expect(getLogCapture()).not.toBeNull();
    });

    it("should set and clear log context", () => {
      initializeLogCapture();

      setLogContext({ runId: "test-run-123" });

      // Context is internal, so we can't directly test it
      // but we can test that it doesn't crash

      clearLogContext();

      expect(getLogCapture()).not.toBeNull();
    });

    it("should stop global log capture", () => {
      initializeLogCapture();
      expect(getLogCapture()).not.toBeNull();

      stopLogCapture();
      expect(getLogCapture()).toBeNull();
    });
  });

  describe("Log upload", () => {
    it("should not upload logs without context", async () => {
      const logCapture = new LogCapture({
        uploadIntervalMs: 100,
        apiKey: "test-key",
      });

      logCapture.startCapture();

      console.log("Test message");

      // Wait a bit longer than upload interval
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should not have called fetch since no context is set
      expect(mockFetch).not.toHaveBeenCalled();

      logCapture.stopCapture();
    });

    it("should upload logs with runId context", async () => {
      const logCapture = new LogCapture({
        uploadIntervalMs: 100,
        apiKey: "test-key",
        environment: "test",
        baseUrl: "https://app.runlightyear.com",
      });

      logCapture.startCapture();
      logCapture.setContext({ runId: "test-run-123" });

      console.log("Test message");

      // Wait for upload
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockFetch).toHaveBeenCalledWith(
        "https://app.runlightyear.com/api/v1/projects/default/envs/test/logs",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-key",
          }),
          body: expect.stringContaining("test-run-123"),
        })
      );

      logCapture.stopCapture();
    });

    it("should not upload without API key", async () => {
      const logCapture = new LogCapture({
        uploadIntervalMs: 100,
        // No API key
      });

      logCapture.startCapture();
      logCapture.setContext({ runId: "test-run-123" });

      console.log("Test message");

      // Wait for upload
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockFetch).not.toHaveBeenCalled();

      logCapture.stopCapture();
    });

    it("should handle upload errors gracefully", async () => {
      // Mock fetch to fail
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const logCapture = new LogCapture({
        uploadIntervalMs: 100,
        apiKey: "test-key",
      });

      logCapture.startCapture();
      logCapture.setContext({ runId: "test-run-123" });

      console.log("Test message");

      // Wait for upload attempt
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should have attempted upload
      expect(mockFetch).toHaveBeenCalled();

      // Should still be capturing
      expect(logCapture.getLogCount()).toBeGreaterThanOrEqual(0);

      logCapture.stopCapture();
    });

    it("should upload remaining logs on stop", async () => {
      const logCapture = new LogCapture({
        uploadIntervalMs: 10000, // Long interval
        apiKey: "test-key",
      });

      logCapture.startCapture();
      logCapture.setContext({ runId: "test-run-123" });

      console.log("Test message");

      // Stop immediately (before interval triggers)
      logCapture.stopCapture();

      // Should have uploaded on stop
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should limit log count to prevent memory issues", () => {
      const logCapture = new LogCapture({
        maxLogsPerBatch: 10,
      });

      logCapture.startCapture();

      // Add more logs than the limit
      for (let i = 0; i < 25; i++) {
        console.log(`Message ${i}`);
      }

      // Should not exceed 2x the batch limit
      expect(logCapture.getLogCount()).toBeLessThanOrEqual(20);

      logCapture.stopCapture();
    });
  });

  describe("Configuration", () => {
    it("should use environment variables for configuration", () => {
      // Mock environment variables
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        LIGHTYEAR_BASE_URL: "https://custom.example.com",
        LIGHTYEAR_ENV: "staging",
        LIGHTYEAR_API_KEY: "env-api-key",
      };

      const logCapture = new LogCapture();

      // Configuration is private, but we can test through behavior
      expect(() => logCapture.startCapture()).not.toThrow();

      logCapture.stopCapture();

      // Restore environment
      process.env = originalEnv;
    });

    it("should use provided config over environment variables", () => {
      const logCapture = new LogCapture({
        baseUrl: "https://config.example.com",
        environment: "custom",
        apiKey: "config-key",
      });

      expect(() => logCapture.startCapture()).not.toThrow();

      logCapture.stopCapture();
    });
  });

  describe("Edge cases", () => {
    it("should handle starting capture multiple times", () => {
      const logCapture = new LogCapture();

      logCapture.startCapture();
      logCapture.startCapture(); // Should not cause issues

      console.log("Test message");

      expect(logCapture.getLogCount()).toBe(1);

      logCapture.stopCapture();
    });

    it("should handle stopping capture multiple times", () => {
      const logCapture = new LogCapture();

      logCapture.startCapture();
      logCapture.stopCapture();
      logCapture.stopCapture(); // Should not cause issues

      expect(() => console.log("Test message")).not.toThrow();
    });

    it("should handle circular reference objects", () => {
      const logCapture = new LogCapture();

      logCapture.startCapture();

      const circular: any = { name: "test" };
      circular.self = circular;

      console.log("Circular object:", circular);

      expect(logCapture.getLogCount()).toBe(1);

      logCapture.stopCapture();
    });

    it("should handle manual flush", async () => {
      const logCapture = new LogCapture({
        apiKey: "test-key",
      });

      logCapture.startCapture();
      logCapture.setContext({ runId: "test-run-123" });

      console.log("Test message");

      await logCapture.flush();

      expect(mockFetch).toHaveBeenCalled();

      logCapture.stopCapture();
    });
  });
});
