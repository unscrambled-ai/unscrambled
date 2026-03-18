import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleRun } from "./run";
import { defineAction, clearRegistry } from "../";

// Mock global console to capture logs
const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

describe("handleRun", () => {
  beforeEach(() => {
    clearRegistry();
    // Clear global action index
    if (typeof globalThis !== "undefined") {
      globalThis.actionIndex = {};
    }
    consoleSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  describe("Payload validation", () => {
    it("should return error when payload is missing", async () => {
      const result = await handleRun();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Missing payload or event data");
    });

    it("should return error when actionName is missing", async () => {
      const result = await handleRun({
        runId: "test-run-123",
        actionName: "",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Missing actionName");
    });

    it("should return error when runId is missing", async () => {
      const result = await handleRun({
        actionName: "test-action",
        runId: "",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Missing runId");
    });
  });

  describe("Action execution", () => {
    it("should execute action successfully", async () => {
      let executedData: any = null;

      // Define an action with a run function
      defineAction("test-action")
        .withTitle("Test Action")
        .withRun(async (props) => {
          executedData = props.data;
        })
        .deploy();

      const result = await handleRun({
        actionName: "test-action",
        runId: "test-run-123",
        data: { message: "Hello World" },
      });

      expect(result.success).toBe(true);
      expect(result.data?.actionName).toBe("test-action");
      expect(result.data?.runId).toBe("test-run-123");
      expect(executedData).toEqual({ message: "Hello World" });
    });

    it("should pass all props to action function", async () => {
      let receivedProps: any = null;

      defineAction("comprehensive-action")
        .withRun(async (props) => {
          receivedProps = props;
        })
        .deploy();

      const testPayload = {
        actionName: "comprehensive-action",
        runId: "test-run-456",
        data: { test: "data" },
        context: { contextKey: "value" },
        auths: { salesforce: { token: "auth-token" } },
        variables: { var1: "value1", var2: null },
        secrets: { secret1: "secret-value" },
        webhook: "webhook-data",
        integration: {
          id: "int-1",
          name: "test-integration",
          title: "Test Integration",
        },
        managedUser: {
          id: "user-1",
          externalId: "ext-123",
          displayName: "Test User",
        },
      };

      const result = await handleRun(testPayload);

      expect(result.success).toBe(true);
      expect(receivedProps).toEqual({
        data: { test: "data" },
        context: { contextKey: "value" },
        auths: { salesforce: { token: "auth-token" } },
        variables: { var1: "value1", var2: null },
        secrets: { secret1: "secret-value" },
        webhook: "webhook-data",
        integration: {
          id: "int-1",
          name: "test-integration",
          title: "Test Integration",
        },
        managedUser: {
          id: "user-1",
          externalId: "ext-123",
          displayName: "Test User",
        },
      });
    });

    it("should handle action with minimal props", async () => {
      let receivedProps: any = null;

      defineAction("minimal-action")
        .withRun(async (props) => {
          receivedProps = props;
        })
        .deploy();

      const result = await handleRun({
        actionName: "minimal-action",
        runId: "test-run-789",
      });

      expect(result.success).toBe(true);
      expect(receivedProps).toEqual({
        data: null,
        context: null,
        auths: {},
        variables: {},
        secrets: {},
        webhook: null,
        integration: null,
        managedUser: null,
      });
    });

    it("should handle direct event structure (like CLI format)", async () => {
      // Register an action
      defineAction("hello-world")
        .withRun(async ({ data }) => {
          // RunFunc should not return a value (Promise<void>)
          console.log("Action executed with data:", data);
        })
        .deploy();

      // Direct event structure (like the user's log output)
      const directEvent = {
        operation: "run",
        actionName: "hello-world",
        runId: "019848cc-b655-7092-8d42-2d79f6b4153d",
        data: { test: "value" },
        logDisplayLevel: "INFO",
      };

      const result = await handleRun(directEvent);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.actionName).toBe("hello-world");
      expect(result.data?.runId).toBe("019848cc-b655-7092-8d42-2d79f6b4153d");
      // Action executed successfully (no return value expected from RunFunc)
    });
  });

  describe("Error handling", () => {
    it("should return error when action is not found", async () => {
      const result = await handleRun({
        actionName: "nonexistent-action",
        runId: "test-run-404",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown action: nonexistent-action");
    });

    it("should return error when action index is not initialized", async () => {
      // Clear the global action index
      if (typeof globalThis !== "undefined") {
        delete (globalThis as any).actionIndex;
      }

      const result = await handleRun({
        actionName: "any-action",
        runId: "test-run-500",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Action index not initialized");
    });

    it("should handle action function throwing an error", async () => {
      defineAction("failing-action")
        .withRun(async () => {
          throw new Error("Action failed!");
        })
        .deploy();

      const result = await handleRun({
        actionName: "failing-action",
        runId: "test-run-error",
        data: { test: "data" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Action failed!");
      expect(result.data?.actionName).toBe("failing-action");
      expect(result.data?.runId).toBe("test-run-error");
      expect(result.data?.errorType).toBe("Error");
    });

    it("should handle action function throwing non-Error object", async () => {
      defineAction("string-error-action")
        .withRun(async () => {
          throw "String error!";
        })
        .deploy();

      const result = await handleRun({
        actionName: "string-error-action",
        runId: "test-run-string-error",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Action execution failed: String error!");
      expect(result.data?.errorType).toBe("string");
    });
  });

  describe("Global action index", () => {
    it("should store actions in global index when deployed", () => {
      const runFunc = async () => {
        /* no-op */
      };

      defineAction("indexed-action").withRun(runFunc).deploy();

      expect(globalThis.actionIndex).toBeDefined();
      expect(globalThis.actionIndex["indexed-action"]).toBe(runFunc);
    });

    it("should handle multiple actions in index", () => {
      const func1 = async () => {
        /* no-op */
      };
      const func2 = async () => {
        /* no-op */
      };

      defineAction("action1").withRun(func1).deploy();
      defineAction("action2").withRun(func2).deploy();

      expect(Object.keys(globalThis.actionIndex)).toContain("action1");
      expect(Object.keys(globalThis.actionIndex)).toContain("action2");
      expect(globalThis.actionIndex["action1"]).toBe(func1);
      expect(globalThis.actionIndex["action2"]).toBe(func2);
    });

    it("should not store action in index if no run function provided", () => {
      defineAction("no-run-action")
        .withTitle("Action without run function")
        .deploy();

      expect(globalThis.actionIndex["no-run-action"]).toBeUndefined();
    });
  });

  describe("Logging", () => {
    it("should log execution details", async () => {
      defineAction("logging-test")
        .withRun(async () => {
          /* no-op */
        })
        .deploy();

      await handleRun({
        actionName: "logging-test",
        runId: "log-test-123",
        data: { key: "value" },
      });

      // Check that appropriate log messages were called
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("startRun →")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("📍 Action: logging-test")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("🆔 Run ID: log-test-123")
      );
    });

    it("should log available actions when action not found", async () => {
      defineAction("available-action")
        .withRun(async () => {})
        .deploy();

      await handleRun({
        actionName: "missing-action",
        runId: "test-123",
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Known actions: available-action")
      );
    });
  });
});
