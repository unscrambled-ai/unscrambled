import type { InternalResponse, RunHandler } from "./types";
import { ValidationError } from "../utils/ValidationError";

interface RunPayload {
  actionName: string;
  runId: string;
  data?: any;
  context?: any;
  auths?: Record<string, any>;
  variables?: Record<string, string | null>;
  secrets?: Record<string, string | null>;
  webhook?: string | null;
  integration?: {
    id: string;
    name: string;
    title: string;
  } | null;
  managedUser?: {
    id: string;
    externalId: string;
    displayName: string | null;
  } | null;
}

// Use the same global declaration as in ActionBuilder
import type { RunFunc } from "../types";
import { addLogRedactionSecrets } from "../logging";

declare global {
  var actionIndex: { [name: string]: RunFunc };
}

export const handleRun: RunHandler = async (
  payloadOrEvent?: RunPayload | any
): Promise<InternalResponse> => {
  const env = process.env.ENV_NAME || "dev";
  const actionName = payloadOrEvent?.actionName ?? "unknown";
  const runId = payloadOrEvent?.runId ?? "none";
  const app = payloadOrEvent?.integration?.name ?? "none";
  const customApp = payloadOrEvent?.integration?.title ?? "none";
  const managedUser = payloadOrEvent?.managedUser?.id ?? "none";
  const type = payloadOrEvent?.type ?? "default";
  const timeout = payloadOrEvent?.timeout ?? "default";
  const fullFrequency = payloadOrEvent?.fullFrequency ?? "default";

  // Example: startRun → env=prod action=myAction runId=abc123 app=none customApp=hubspot managedUser=5862 type=FULL timeout=default
  console.log(
    `startRun → env=${env} action=${actionName} runId=${runId} app=${app} customApp=${customApp} managedUser=${managedUser} fullFrequency=${fullFrequency} type=${type} timeout=${timeout}`
  );

  // Handle both payload structure and direct event structure
  let runData: RunPayload;

  try {
    if (!payloadOrEvent) {
      console.error("❌ Missing payload or event data");
      return {
        success: false,
        error: "Missing payload or event data",
        logs: [],
      };
    }

    // Check if this is a direct event structure (has actionName at top level)
    // or a wrapped payload structure
    if (payloadOrEvent.actionName && payloadOrEvent.runId) {
      // Direct event structure - extract run data directly
      runData = {
        actionName: payloadOrEvent.actionName,
        runId: payloadOrEvent.runId,
        data: payloadOrEvent.data,
        context: payloadOrEvent.context,
        auths: payloadOrEvent.auths,
        variables: payloadOrEvent.variables,
        secrets: payloadOrEvent.secrets,
        webhook: payloadOrEvent.webhook,
        integration: payloadOrEvent.integration,
        managedUser: payloadOrEvent.managedUser,
      };
      console.log("📦 Using direct event structure for run data");
    } else {
      // Assume it's already a proper RunPayload structure
      runData = payloadOrEvent as RunPayload;
      console.log("📦 Using payload structure for run data");
    }

    const {
      actionName,
      runId,
      data,
      context,
      auths,
      variables,
      secrets,
      webhook,
      integration,
      managedUser,
    } = runData;

    if (!actionName) {
      console.error("❌ Missing actionName");
      return {
        success: false,
        error: "Missing actionName",
        logs: [],
      };
    }

    if (!runId) {
      console.error("❌ Missing runId");
      return {
        success: false,
        error: "Missing runId",
        logs: [],
      };
    }

    console.log(`📍 Action: ${actionName}`);
    console.log(`🆔 Run ID: ${runId}`);
    console.log(
      `📊 Data keys: ${data ? Object.keys(data).join(", ") : "none"}`
    );

    // Check if global action index exists and has the action
    if (typeof globalThis === "undefined" || !globalThis.actionIndex) {
      console.error("❌ Action index not initialized");
      return {
        success: false,
        error: "Action index not initialized",
        logs: [],
      };
    }

    console.log(
      `🔍 Available actions: ${Object.keys(globalThis.actionIndex).join(", ")}`
    );

    const runFunction = globalThis.actionIndex[actionName];
    if (!runFunction) {
      console.error(`❌ Unknown action: ${actionName}`);
      console.error(
        `Known actions: ${Object.keys(globalThis.actionIndex).join(", ")}`
      );
      return {
        success: false,
        error: `Unknown action: ${actionName}`,
        logs: [],
      };
    }

    console.log(`🚀 Executing action function...`);

    // If managedUser is not provided, fetch run function props from the platform
    let effectiveAuths = auths || {};
    let effectiveVariables = variables || {};
    let effectiveSecrets = secrets || {};
    let effectiveWebhook = webhook || null;
    let effectiveIntegration = integration || null;
    let effectiveManagedUser = managedUser || null;

    console.log("📊 Initial variables from payload:", variables);
    console.log("📊 Initial effective variables:", effectiveVariables);

    try {
      if (!effectiveManagedUser && runId) {
        console.log("🔄 Fetching run function props from API...");
        const { getRunFuncProps } = await import("../platform/run.js");
        const fetched = await getRunFuncProps(runId);
        // Register secrets for log redaction before logging fetched props
        const secretsToAdd: Array<string | null> = [];
        if (fetched?.auths) {
          for (const auth of Object.values(
            fetched.auths as Record<string, any>
          )) {
            if (auth && typeof auth === "object") {
              secretsToAdd.push(auth.accessToken || null);
              secretsToAdd.push(auth.refreshToken || null);
              secretsToAdd.push(auth.apiKey || null);
              secretsToAdd.push(auth.password || null);
            }
          }
        }
        if (fetched?.secrets) {
          secretsToAdd.push(...Object.values(fetched.secrets));
        }
        // Add once so future logs are masked
        addLogRedactionSecrets(secretsToAdd);
        console.debug(
          "📥 Fetched run props:",
          JSON.stringify(fetched, null, 2)
        );
        if (fetched) {
          effectiveAuths = fetched.auths || effectiveAuths;
          effectiveVariables = fetched.variables || effectiveVariables;
          effectiveSecrets = fetched.secrets || effectiveSecrets;
          effectiveWebhook = fetched.webhook || effectiveWebhook;
          // Ensure integration title is a string if present
          if (fetched.integration) {
            effectiveIntegration = {
              id: fetched.integration.id,
              name: fetched.integration.name,
              title: fetched.integration.title || fetched.integration.name,
            } as any;
          }
          effectiveManagedUser = fetched.managedUser || effectiveManagedUser;
          // Extract syncId from fetched props and add to context
          const fetchedSyncId = fetched.syncId;
          if (fetchedSyncId) {
            console.log(
              `🔍 Handler: Extracted syncId from run-func-props: ${fetchedSyncId}`
            );
          }
          // Populate execution/log context with managed user, integration, app/customApp, and syncId
          try {
            const { getLogCapture } = await import("../logging/index.js");
            const ctx: any = {
              integrationName: effectiveIntegration?.name,
            };
            if (effectiveManagedUser?.externalId) {
              ctx.managedUserId = effectiveManagedUser.externalId;
              ctx.managedUserExternalId = effectiveManagedUser.externalId;
              ctx.managedUserDisplayName =
                effectiveManagedUser.displayName ?? null;
            }
            const appInfo: any = (effectiveIntegration as any)?.app;
            if (appInfo?.type === "builtin" && appInfo?.name) {
              ctx.appName = appInfo.name;
            } else if (appInfo?.type === "custom" && appInfo?.name) {
              ctx.customAppName = appInfo.name;
            }
            // Fallback: if no app/customApp yet and exactly one auth, consider it custom app
            if (!ctx.appName && !ctx.customAppName) {
              const authKeys = Object.keys(effectiveAuths || {});
              if (authKeys.length === 1) {
                ctx.customAppName = authKeys[0];
              }
            }
            // Add syncId to context if present
            if (fetchedSyncId) {
              ctx.syncId = fetchedSyncId;
              console.log(
                `✅ Handler: Set syncId in context: ${fetchedSyncId}`
              );
            }
            if (Object.keys(ctx).length > 0) {
              getLogCapture()?.setContext(ctx);
            }
          } catch {}
        }
      }
    } catch (e) {
      console.debug("Optional run props fetch failed:", e);
    }

    // Execute the action function with the provided data
    // First, we need to clean up variable and secret names by removing "?" suffix
    // This is because the backend sends variables with "?" suffix for optional ones,
    // but our type system expects clean names without the suffix
    const cleanedVariables: Record<string, string | null> = {};
    if (effectiveVariables) {
      for (const [key, value] of Object.entries(effectiveVariables)) {
        // Remove "?" suffix if present
        const cleanKey = key.endsWith("?") ? key.slice(0, -1) : key;
        cleanedVariables[cleanKey] = value;
      }
    }

    const cleanedSecrets: Record<string, string | null> = {};
    if (effectiveSecrets) {
      for (const [key, value] of Object.entries(effectiveSecrets)) {
        const cleanKey = key.endsWith("?") ? key.slice(0, -1) : key;
        cleanedSecrets[cleanKey] = value;
      }
    }

    const runProps = {
      data: data || null,
      context: context || null,
      auths: effectiveAuths,
      variables: cleanedVariables,
      secrets: cleanedSecrets,
      webhook: effectiveWebhook,
      integration: effectiveIntegration,
      managedUser: effectiveManagedUser,
    };

    try {
      await runFunction(runProps);
    } catch (e) {
      if (e === "SKIPPED") {
        console.warn("Run skipped by action");
        try {
          const { finishRun } = await import("../platform/run.js");
          await finishRun({ runId, status: "SKIPPED" });
        } catch (finishErr) {
          console.warn("finishRun(SKIPPED) failed:", finishErr);
        }
        return {
          success: true,
          data: { message: "Skipped", status: "SKIPPED" },
          logs: [],
        };
      }
      if (e === "RERUN") {
        console.info("Rerun requested by action");
        try {
          const { finishRun } = await import("../platform/run.js");
          await finishRun({ runId, status: "SUCCEEDED", rerun: true });
        } catch (finishErr) {
          console.warn("finishRun(SUCCEEDED, rerun=true) failed:", finishErr);
        }
        return {
          success: true,
          data: { message: "Rerun", status: "RERUN" },
          logs: [],
        };
      }
      // If run was canceled, surface a clean message and skip finishRun
      try {
        const { isRunCanceled } = await import("../logging/index.js");
        if (isRunCanceled()) {
          console.warn("Run canceled during execution");
          return {
            success: true,
            data: { message: "Run canceled", status: "CANCELED" },
            logs: [],
          };
        }
      } catch {}
      throw e;
    }

    console.log("✅ Action executed successfully!");

    try {
      const { finishRun } = await import("../platform/run.js");
      await finishRun({ runId, status: "SUCCEEDED" });
    } catch (finishErr) {
      console.warn("finishRun(SUCCEEDED) failed:", finishErr);
    }

    return {
      success: true,
      data: {
        message: "Action executed successfully",
        actionName,
        runId,
        executedAt: new Date().toISOString(),
      },
      logs: [],
    };
  } catch (error) {
    console.error("💥 Action execution failed!");

    // Handle validation errors specially (check flag since error may have been serialized)
    if (
      error &&
      (error instanceof ValidationError || (error as any).__isValidationError)
    ) {
      console.error(`💬 Error message:\n${(error as any).message || error}`);
      // No stack trace for validation errors
    } else if (error instanceof Error) {
      console.error(`💬 Error message:\n${error.message}`);

      // Log stack trace for non-validation errors
      if (error.stack) {
        console.error(`🔍 Error stack:`);
        console.error(error.stack);
      }
    } else {
      console.error(`🤷 Non-Error object thrown:`);
      console.error(`   Type: ${typeof error}`);
      console.error(`   Value:`, error);
      console.error(`   String representation: ${String(error)}`);
    }

    let errorMessage =
      error instanceof Error
        ? error.message
        : `Action execution failed: ${String(error)}`;
    try {
      const { isRunCanceled } = await import("../logging/index.js");
      if (isRunCanceled()) {
        errorMessage = "Run canceled";
      }
    } catch {}

    // Attempt to finish the run as FAILED if we have a runId
    try {
      const runId = payloadOrEvent?.runId;
      // Do not finish as FAILED if canceled
      const { isRunCanceled } = await import("../logging/index.js");
      if (runId && !isRunCanceled()) {
        const { finishRun } = await import("../platform/run.js");
        await finishRun({ runId, status: "FAILED" });
      }
    } catch (finishErr) {
      console.warn("finishRun(FAILED) failed:", finishErr);
    }

    return {
      success: errorMessage === "Run canceled" ? true : false,
      error: errorMessage === "Run canceled" ? undefined : errorMessage,
      data: {
        actionName: payloadOrEvent?.actionName || "unknown",
        runId: payloadOrEvent?.runId || "unknown",
        failedAt:
          errorMessage === "Run canceled"
            ? undefined
            : new Date().toISOString(),
        status: errorMessage === "Run canceled" ? "CANCELED" : undefined,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
        errorName: error instanceof Error ? error.name : "Unknown",
      },
      logs: [],
    };
  }
};
