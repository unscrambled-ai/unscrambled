import { exportRegistry } from "../registry";
import type { InternalResponse, DeployHandler } from "./types";

interface DeployPayload {
  environment?: string;
  dryRun?: boolean;
  baseUrl?: string;
  apiKey?: string;
  [key: string]: any;
}

interface ModelSchema {
  name: string;
  title: string;
  schema?: any;
  matchOn?: any;
}

interface CollectionProps {
  name: string;
  title: string;
  models?: ModelSchema[];
}

interface CustomAppProps {
  name: string;
  title: string;
  authType: "OAUTH2" | "APIKEY" | "BASIC";
  hasOAuth?: boolean;
  hasAppWebhook?: boolean;
  variables?: Array<string | { name: string; description?: string }>;
  secrets?: Array<string | { name: string; description?: string }>;
}

interface SyncScheduleProps {
  type: "INCREMENTAL" | "FULL" | "BASELINE";
  every?: number | string;
  maxRetries?: number; // Required when type is "BASELINE"
}

interface ActionTrigger {
  webhook?: string;
  pollingFrequency?: number;
}

interface IntegrationProps {
  name: string;
  title: string;
  description?: string;
  app?: string; // For built-in apps
  customApp?: string; // For custom apps
  collection: string; // Collection name (required)
  actions?: string[]; // Array of action names
  webhooks?: string[]; // Array of webhook names
  syncSchedules?: SyncScheduleProps[]; // Array of sync schedules
  readOnly?: boolean; // If true, entire integration is read-only
  writeOnly?: boolean; // If true, entire integration is write-only
  modelPermissions?: Array<{
    model: string; // Model name
    readOnly?: boolean; // If true, this model is read-only
    writeOnly?: boolean; // If true, this model is write-only
  }>; // Array of model-specific permissions
}

interface ActionProps {
  name: string;
  title: string;
  description?: string;
  type: "FULL_SYNC" | "INCREMENTAL_SYNC" | null;
  trigger?: ActionTrigger;
  apps?: string[];
  customApps?: string[];
  variables?: Array<string | { name: string; description?: string }>;
  secrets?: Array<string | { name: string; description?: string }>;
}

interface WebhookProps {
  name: string;
  title: string;
  apps?: string[];
  customApps?: string[];
  variables?: Array<string | { name: string; description?: string }>;
  secrets?: Array<string | { name: string; description?: string }>;
}

interface DeploymentItem {
  type: "collection" | "customApp" | "integration" | "action" | "webhook";
  collectionProps?: CollectionProps;
  customAppProps?: CustomAppProps;
  integrationProps?: IntegrationProps;
  actionProps?: ActionProps;
  webhookProps?: WebhookProps;
}

const REQUEST_ID_HEADER_NAMES = [
  "x-request-id",
  "x-amzn-requestid",
  "x-amz-request-id",
  "x-correlation-id",
  "x-vercel-id",
] as const;

function getFetchResponseRequestId(response: Response): string | undefined {
  for (const headerName of REQUEST_ID_HEADER_NAMES) {
    const headerValue = response.headers.get(headerName);
    if (headerValue?.trim()) {
      return headerValue;
    }
  }

  return undefined;
}

function formatRequestIdSuffix(requestId?: string): string {
  return requestId ? ` (requestId: ${requestId})` : "";
}

function transformRegistryToDeploymentSchema(
  registryData: any
): DeploymentItem[] {
  console.debug("Starting registry transformation...");
  const deploymentItems: DeploymentItem[] = [];

  if (
    !registryData ||
    !registryData.items ||
    !Array.isArray(registryData.items)
  ) {
    console.warn(
      "Invalid registry data provided to transformRegistryToDeploymentSchema"
    );
    console.debug("Registry data structure:", registryData);
    return deploymentItems;
  }

  console.debug(`Processing ${registryData.items.length} registry items...`);

  for (const [index, item] of registryData.items.entries()) {
    console.debug(
      `Processing item ${index + 1}/${registryData.items.length}: type=${
        item?.type || "unknown"
      }`
    );

    if (!item || typeof item !== "object" || !item.type) {
      console.warn("Skipping invalid registry item:", item);
      continue;
    }

    switch (item.type) {
      case "collection":
        console.debug("   Processing collection...");

        if (!item.collection || typeof item.collection !== "object") {
          console.warn("   Skipping collection with invalid data:", item);
          continue;
        }

        const collectionItem = {
          type: "collection" as const,
          collectionProps: {
            name: item.collection.name || "unnamed-collection",
            title:
              item.collection.title ||
              item.collection.name ||
              "Unnamed Collection",
            models:
              item.collection.models
                ?.map((model: any) => ({
                  name: model?.name || "unnamed-model",
                  title: model?.title || model?.name || "Unnamed Model",
                  schema: model?.schema || undefined,
                  matchOn: model?.matchPattern || undefined,
                }))
                .filter(Boolean) || [],
          },
        };

        console.debug(
          `   Collection processed: ${collectionItem.collectionProps.name} (${collectionItem.collectionProps.models.length} models)`
        );
        deploymentItems.push(collectionItem);
        break;

      case "customApp":
        console.debug("   Processing custom app...");

        if (!item.customApp || typeof item.customApp !== "object") {
          console.warn("   Skipping customApp with invalid data:", item);
          continue;
        }

        const variables =
          item.customApp.variables
            ?.map((variable: any) => {
              if (!variable) return null;
              return variable.title || variable.description
                ? {
                    name: variable.name || "unnamed-variable",
                    description: variable.title || variable.description,
                  }
                : variable.name || "unnamed-variable";
            })
            .filter(Boolean) || [];

        const secrets =
          item.customApp.secrets
            ?.map((secret: any) => {
              if (!secret) return null;
              return secret.title || secret.description
                ? {
                    name: secret.name || "unnamed-secret",
                    description: secret.title || secret.description,
                  }
                : secret.name || "unnamed-secret";
            })
            .filter(Boolean) || [];

        const customAppItem = {
          type: "customApp" as const,
          customAppProps: {
            name: item.customApp.name || "unnamed-custom-app",
            title:
              item.customApp.title ||
              item.customApp.name ||
              "Unnamed Custom App",
            authType: item.customApp.type || "OAUTH2",
            hasOAuth: item.customApp.oauthConnector ? true : undefined,
            isOwnApp: item.customApp.isOwnApp ?? false,
            variables: variables.length > 0 ? variables : undefined,
            secrets: secrets.length > 0 ? secrets : undefined,
          },
        };

        console.debug(
          `   Custom app processed: ${customAppItem.customAppProps.name} (auth=${customAppItem.customAppProps.authType})`
        );
        deploymentItems.push(customAppItem);
        break;

      case "integration":
        console.debug("   Processing integration...");

        if (!item.integration || typeof item.integration !== "object") {
          console.warn("   Skipping integration with invalid data:", item);
          continue;
        }

        // Transform SDK integration format to API format
        const integration = item.integration;

        // Collection is required
        if (!integration.collection) {
          console.warn("   Skipping integration without collection:", item);
          continue;
        }

        const integrationProps: IntegrationProps = {
          name: integration.name || "unnamed-integration",
          title: integration.title || integration.name || "Unnamed Integration",
          description: integration.description,
          collection: integration.collection.name,
        };

        // Handle app vs customApp based on integration.app.type
        if (integration.app) {
          if (integration.app.type === "builtin") {
            integrationProps.app = integration.app.name;
          } else if (integration.app.type === "custom") {
            integrationProps.customApp = integration.app.name;
          }
        }

        // Add actions if they exist
        if (
          integration.actions &&
          Object.keys(integration.actions).length > 0
        ) {
          integrationProps.actions = Object.keys(integration.actions);
        }

        if (
          integration.webhooks &&
          Object.keys(integration.webhooks).length > 0
        ) {
          integrationProps.webhooks = Object.keys(integration.webhooks);
        }

        // Add sync schedules if they exist
        if (integration.syncSchedules && integration.syncSchedules.length > 0) {
          integrationProps.syncSchedules = integration.syncSchedules;
        }

        // Add read-only/write-only flags if they exist
        if (integration.readOnly !== undefined) {
          integrationProps.readOnly = integration.readOnly;
        }
        if (integration.writeOnly !== undefined) {
          integrationProps.writeOnly = integration.writeOnly;
        }

        // Add model permissions if they exist
        if (
          integration.modelPermissions &&
          integration.modelPermissions.length > 0
        ) {
          integrationProps.modelPermissions = integration.modelPermissions;
        }

        const integrationItem = {
          type: "integration" as const,
          integrationProps,
        };

        console.debug(
          `   Integration processed: ${integrationItem.integrationProps.name}`
        );
        deploymentItems.push(integrationItem);
        break;

      case "action":
        console.debug("   Processing action...");

        if (!item.action || typeof item.action !== "object") {
          console.warn("   Skipping action with invalid data:", item);
          continue;
        }

        const actionVariables =
          item.action.variables
            ?.map((variable: any) => {
              if (!variable) return null;
              return variable.title || variable.description
                ? {
                    name: variable.name || "unnamed-variable",
                    description: variable.title || variable.description,
                  }
                : variable.name || "unnamed-variable";
            })
            .filter(Boolean) || [];

        const actionSecrets =
          item.action.secrets
            ?.map((secret: any) => {
              if (!secret) return null;
              return secret.title || secret.description
                ? {
                    name: secret.name || "unnamed-secret",
                    description: secret.title || secret.description,
                  }
                : secret.name || "unnamed-secret";
            })
            .filter(Boolean) || [];

        const actionItem = {
          type: "action" as const,
          actionProps: {
            name: item.action.name || "unnamed-action",
            title: item.action.title || item.action.name || "Unnamed Action",
            description: item.action.description,
            type: item.action.type ?? null,
            trigger: item.action.trigger,
            apps:
              item.action.apps && item.action.apps.length > 0
                ? item.action.apps
                : undefined,
            customApps:
              item.action.customApps && item.action.customApps.length > 0
                ? item.action.customApps
                : undefined,
            variables: actionVariables.length > 0 ? actionVariables : undefined,
            secrets: actionSecrets.length > 0 ? actionSecrets : undefined,
          },
        };

        console.debug(`   Action processed: ${actionItem.actionProps.name}`);
        deploymentItems.push(actionItem);
        break;

      case "webhook":
        console.debug("   Processing webhook...");

        if (!item.webhook || typeof item.webhook !== "object") {
          console.warn("   Skipping webhook with invalid data:", item);
          continue;
        }

        const webhookVariables =
          item.webhook.variables
            ?.map((variable: any) => {
              if (!variable) return null;
              return variable.title || variable.description
                ? {
                    name: variable.name || "unnamed-variable",
                    description: variable.title || variable.description,
                  }
                : variable.name || "unnamed-variable";
            })
            .filter(Boolean) || [];

        const webhookSecrets =
          item.webhook.secrets
            ?.map((secret: any) => {
              if (!secret) return null;
              return secret.title || secret.description
                ? {
                    name: secret.name || "unnamed-secret",
                    description: secret.title || secret.description,
                  }
                : secret.name || "unnamed-secret";
            })
            .filter(Boolean) || [];

        const webhookItem = {
          type: "webhook" as const,
          webhookProps: {
            name: item.webhook.name || "unnamed-webhook",
            title: item.webhook.title || item.webhook.name || "Unnamed Webhook",
            apps:
              item.webhook.apps && item.webhook.apps.length > 0
                ? item.webhook.apps
                : undefined,
            customApps:
              item.webhook.customApps && item.webhook.customApps.length > 0
                ? item.webhook.customApps
                : undefined,
            variables:
              webhookVariables.length > 0 ? webhookVariables : undefined,
            secrets: webhookSecrets.length > 0 ? webhookSecrets : undefined,
          },
        };

        console.debug(`   Webhook processed: ${webhookItem.webhookProps.name}`);
        deploymentItems.push(webhookItem);
        break;

      case "model":
        console.debug(
          `   Skipping standalone model: ${item.model?.name || "unnamed"}`
        );
        break;

      default:
        console.warn(`   Unknown registry item type: ${item.type}`);
    }
  }

  console.debug(
    `Transformation complete: ${deploymentItems.length} deployable items`
  );

  return deploymentItems;
}

async function postDeploymentData(
  deploymentData: DeploymentItem[],
  payload: DeployPayload
): Promise<any> {
  const baseUrl =
    payload.baseUrl || process.env.BASE_URL || "https://app.unscrambled.ai";
  const envName = payload.environment || process.env.ENV_NAME || "dev";
  const url = `${baseUrl}/api/v1/projects/default/envs/${envName}/deploy`;

  console.debug(`Deploy target: ${url} (env=${envName})`);

  try {
    const deploymentDataJson = JSON.stringify(deploymentData, null, 2);
    console.debug(
      `Deployment data (${deploymentDataJson.length} chars):`,
      deploymentDataJson
    );
  } catch (jsonError) {
    console.error("Error serializing deployment data:", jsonError);
    throw new Error(
      `Failed to serialize deployment data: ${
        jsonError instanceof Error ? jsonError.message : "Unknown error"
      }`
    );
  }

  if (payload.dryRun) {
    console.debug("Dry run mode - skipping actual HTTP request");
    return { dryRun: true, url, data: deploymentData };
  }

  const apiKey =
    payload.apiKey || process.env.UNSCRAMBLED_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing API key. Provide via payload.apiKey or UNSCRAMBLED_API_KEY/API_KEY environment variable."
    );
  }

  const requestHeaders = {
    "Content-Type": "application/json",
    "User-Agent": "@unscrambled/sdk",
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
    "X-SDK-Version": "0.1.0",
    "X-Environment": envName,
    "X-Request-ID": `req_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`,
  };

  const requestBody = JSON.stringify(deploymentData);
  console.debug(
    `POST ${url} (${requestBody.length} bytes, ${deploymentData.length} items)`
  );

  const startTime = Date.now();

  // Make the ACTUAL HTTP request using fetch with retries for transient errors
  const maxAttempts = 5; // total attempts including first
  let attempt = 1;
  let response: Response | null = null;
  while (true) {
    try {
      response = await fetch(url, {
        method: "POST",
        headers: requestHeaders,
        body: requestBody,
      });

      if (!response.ok) {
        const requestId = getFetchResponseRequestId(response);
        const retriable =
          response.status === 429 ||
          (response.status >= 500 && response.status < 600);
        if (retriable && attempt < maxAttempts) {
          const waitMs =
            Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 5000);
          console.warn(
            `Transient deploy API error ${
              response.status
            }${formatRequestIdSuffix(requestId)}. Retrying in ${(
              waitMs / 1000
            ).toFixed(2)}s (attempt ${attempt}/${maxAttempts})`
          );
          await new Promise((r) => setTimeout(r, waitMs));
          attempt += 1;
          continue;
        }
      }
      break;
    } catch (err: any) {
      const isNetworkError = err && !("status" in (err as any));
      if (isNetworkError && attempt < maxAttempts) {
        const waitMs =
          Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 5000);
        console.warn(
          `Network error calling deploy API. Retrying in ${(
            waitMs / 1000
          ).toFixed(2)}s (attempt ${attempt}/${maxAttempts})`
        );
        await new Promise((r) => setTimeout(r, waitMs));
        attempt += 1;
        continue;
      }
      throw err;
    }
  }

  const duration = Date.now() - startTime;

  const responseText = await response.text();
  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    console.debug("Response body (raw):", responseText);
  }

  const requestId = getFetchResponseRequestId(response);

  console.debug(
    `Deploy API responded ${
      response.status
    } in ${duration}ms${formatRequestIdSuffix(requestId)}`
  );

  if (!response.ok) {
    const responseErrorMessage =
      responseData?.message || responseData?.error || undefined;

    throw new Error(
      `HTTP ${response.status}: ${response.statusText}${
        responseErrorMessage ? ` - ${responseErrorMessage}` : ""
      }${formatRequestIdSuffix(requestId)}`
    );
  }

  return (
    responseData || {
      status: "success",
      message: "Deployment request sent successfully",
      httpStatus: response.status,
      responseSize: responseText.length,
    }
  );
}

export const handleDeploy: DeployHandler = async (
  payload?: DeployPayload
): Promise<InternalResponse> => {
  // Use empty object as default if no payload provided
  const deployPayload: DeployPayload = payload || {};

  console.debug("Deploy operation called", { payload: deployPayload });

  try {
    const exported = exportRegistry();
    console.debug(`Registry: ${exported.items.length} items`);

    const deploymentData = transformRegistryToDeploymentSchema(exported);

    if (deploymentData.length === 0) {
      console.debug("No deployable items found; sending empty deployment");
    }

    const deploymentResult = await postDeploymentData(
      deploymentData,
      deployPayload
    );

    console.info(`Deployed ${deploymentData.length} items successfully`);

    return {
      success: true,
      data: {
        message: `Deployment completed successfully with ${deploymentData.length} items`,
        deployment: deploymentResult,
        registry: exported,
        deployedItems: deploymentData.length,
        empty: deploymentData.length === 0,
        environment:
          deployPayload.environment || process.env.ENV_NAME || "default",
        dryRun: deployPayload.dryRun === true,
        deployedAt: new Date().toISOString(),
      },
      stats: {
        totalItems: exported.items.length,
        deployedItems: deploymentData.length,
        collections: deploymentData.filter((item) => item.type === "collection")
          .length,
        customApps: deploymentData.filter((item) => item.type === "customApp")
          .length,
        integrations: deploymentData.filter(
          (item) => item.type === "integration"
        ).length,
        actions: deploymentData.filter((item) => item.type === "action").length,
        webhooks: deploymentData.filter((item) => item.type === "webhook")
          .length,
      },
      logs: [],
    };
  } catch (error) {
    console.error(
      "Deploy failed:",
      error instanceof Error ? error.message : error
    );
    console.debug("Deploy error details:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : `Deployment failed: ${String(error)}`;

    return {
      success: false,
      error: errorMessage,
      data: {
        environment:
          deployPayload.environment || process.env.ENV_NAME || "default",
        dryRun: deployPayload.dryRun === true,
        failedAt: new Date().toISOString(),
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
        errorName: error instanceof Error ? error.name : "Unknown",
      },
      logs: [],
    };
  }
};
