import { getCurrentContext } from "../logging";
import { categorizeHttpStatus } from "../utils";

/**
 * @public
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpProxyRequestHeaders {
  [key: string]: string;
}

/**
 * @public
 */
export interface HttpProxyRequestProps {
  method?: HttpMethod;
  url: string;
  params?: Record<string, any>;
  headers?: HttpProxyRequestHeaders;
  /**
   * @deprecated Use `json` for JSON payloads or `body` for raw string bodies.
   */
  data?: object;
  body?: string;
  json?: unknown;
  redactKeys?: string[];
  maxRetries?: number;
  async?: boolean;
  /**
   * Sync information for async write operations
   */
  syncInfo?: {
    syncId: string;
    modelName: string;
    changeIds: string[];
    confirmationPaths?: {
      externalIdPath: string;
      externalUpdatedAtPath: string;
    };
  };
  /**
   * Managed user ID for auth templating
   */
  managedUserId?: string;
  /**
   * Managed user external ID for auth templating
   */
  managedUserExternalId?: string;
  /**
   * Integration name for auth templating
   */
  integrationName?: string;
}

/**
 * @public
 */
export type HttpProxyResponse = {
  /**
   * The http status of the proxied response
   */
  status: number;
  /**
   * The http status test of the proxied response
   */
  statusText: string;
  /**
   * The response headers of the proxied response
   */
  headers: any;
  /**
   * The http body of the proxied response
   */
  data: any;
  /**
   * The httpRequestId for async requests (optional)
   */
  httpRequestId?: string;
};

/**
 * @public
 */
export class HttpProxyResponseError extends Error {
  response: HttpProxyResponse;

  constructor(response: HttpProxyResponse) {
    super(`HttpProxyResponseError: ${response.status} ${response.statusText}`);
    this.response = response;

    Object.setPrototypeOf(this, HttpProxyResponseError.prototype);
  }
}

export function isHttpProxyResponseError(
  error: unknown
): error is HttpProxyResponseError {
  return !!error && typeof error === "object" && "response" in error;
}

export interface HttpRequest {
  (props: HttpProxyRequestProps): Promise<HttpProxyResponse>;
}

function getRandomJitter(maxJitter: number): number {
  return Math.floor(Math.random() * maxJitter);
}

async function exponentialBackoffWithJitter(retryCount: number): Promise<void> {
  const baseWaitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
  const jitter = getRandomJitter(5000); // Add up to 5 seconds of jitter
  const waitTime = baseWaitTime + jitter;
  console.log(`XXX Retrying in ${(waitTime / 1000).toFixed(2)} seconds...`);
  await new Promise((resolve) => setTimeout(resolve, waitTime));
}

// Get the current context values from log context
function getCurrentRunContext(): {
  runId?: string;
  syncId?: string;
  modelName?: string;
  integrationName?: string;
  managedUserId?: string;
  managedUserExternalId?: string;
  managedUserDisplayName?: string | null;
} {
  const ctx = getCurrentContext();
  return {
    runId: ctx.runId,
    syncId: (ctx as any).syncId,
    modelName: (ctx as any).modelName,
    integrationName: (ctx as any).integrationName,
    managedUserId: (ctx as any).managedUserId,
    managedUserExternalId: (ctx as any).managedUserExternalId,
    managedUserDisplayName: (ctx as any).managedUserDisplayName ?? null,
  };
}

/**
 * @public
 */
export interface BatchHttpProxyRequestProps {
  requests: Array<HttpProxyRequestProps>;
  syncId?: string;
}

/**
 * @public
 */
export interface BatchHttpProxyResponse {
  batchId: string;
}

export interface BatchHttpRequest {
  (props: BatchHttpProxyRequestProps): Promise<BatchHttpProxyResponse>;
}

// HTTP implementation for SDK that uses the Lightyear proxy infrastructure
export const httpRequest: HttpRequest = async (props) => {
  const { redactKeys, maxRetries = 3, ...rest } = props;

  // Get environment variables
  const envName = process.env.ENV_NAME || "dev";
  const baseUrl = process.env.BASE_URL || "https://app.runlightyear.com";
  const apiKey = process.env.LIGHTYEAR_API_KEY || process.env.API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing API key. Set LIGHTYEAR_API_KEY or API_KEY environment variable."
    );
  }

  // Get the current run and execution context
  const {
    runId,
    syncId,
    modelName,
    integrationName,
    managedUserId,
    managedUserExternalId,
  } = getCurrentRunContext();

  console.debug("SDK httpRequest - runId from context:", runId);
  console.debug("SDK httpRequest - props:", JSON.stringify(rest, null, 2));

  const maxBackoffs = 5;
  let backoffCount = 0;

  do {
    try {
      // Use the same proxy endpoint as the lightyear package
      const proxyUrl = `${baseUrl}/api/v1/projects/default/envs/${envName}/http-request`;

      // Normalize json/data/body for proxy: prefer explicit body, then json, then data
      const {
        headers: providedHeaders,
        body: providedBody,
        json: providedJson,
        data: providedData,
        ...restWithoutPayload
      } = rest as unknown as {
        headers?: Record<string, string>;
        body?: string;
        json?: unknown;
        data?: unknown;
        [key: string]: any;
      };

      let finalBody: string | undefined = providedBody;
      if (finalBody == null && providedJson !== undefined) {
        finalBody = JSON.stringify(providedJson);
      } else if (finalBody == null && providedData !== undefined) {
        // Back-compat: treat legacy `data` like json
        finalBody = JSON.stringify(providedData);
      }

      const finalHeaders: Record<string, string> = {
        ...(providedHeaders || {}),
      };
      // If we are sending JSON, ensure content-type is set
      if (
        finalBody !== undefined &&
        !Object.keys(finalHeaders).some(
          (h) => h.toLowerCase() === "content-type"
        )
      ) {
        finalHeaders["Content-Type"] = "application/json";
      }

      // Append query params to URL instead of sending a separate `params` field
      const { params, url, ...restForProxy } =
        restWithoutPayload as unknown as {
          url: string;
          params?: Record<string, unknown>;
          [key: string]: any;
        };

      let urlWithQuery = url;
      if (params && Object.keys(params).length > 0) {
        try {
          const u = new URL(urlWithQuery);
          for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) continue;
            u.searchParams.append(key, String(value));
          }
          urlWithQuery = u.toString();
        } catch {
          // Fallback for relative URLs (shouldn't happen with RestConnector.buildUrl)
          const qs = Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(
              ([k, v]) =>
                `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
            )
            .join("&");
          urlWithQuery = qs
            ? `${urlWithQuery}${urlWithQuery.includes("?") ? "&" : "?"}${qs}`
            : urlWithQuery;
        }
      }

      // Use syncInfo from request props
      const syncInfo = rest.syncInfo;

      // Use explicit auth params from props, or fall back to context
      const effectiveManagedUserId = rest.managedUserId || managedUserId;
      const effectiveManagedUserExternalId =
        rest.managedUserExternalId || managedUserExternalId;
      const effectiveIntegrationName = rest.integrationName || integrationName;

      const requestBody: any = {
        ...restForProxy,
        url: urlWithQuery,
        headers: finalHeaders,
        body: finalBody,
        runId,
      };

      // Add syncInfo if present
      if (syncInfo) {
        requestBody.syncInfo = syncInfo;
      }

      // Add auth params if present (for templating)
      // Only send one of managedUserId or managedUserExternalId (API doesn't allow both)
      if (effectiveManagedUserExternalId) {
        requestBody.managedUserExternalId = effectiveManagedUserExternalId;
      } else if (effectiveManagedUserId) {
        requestBody.managedUserId = effectiveManagedUserId;
      }
      if (effectiveIntegrationName) {
        requestBody.integrationName = effectiveIntegrationName;
      }

      // Remove deprecated fields that are now in syncInfo
      delete requestBody.changeId;
      delete requestBody.changeIds;

      console.debug("Making proxy request to:", proxyUrl);
      console.debug("Request body:", JSON.stringify(requestBody, null, 2));

      const response = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Decide retry based on categorization utility
        const isRetriableHttpStatus =
          categorizeHttpStatus(response.status) === "temporary";

        if (isRetriableHttpStatus) {
          backoffCount += 1;
          if (backoffCount > maxBackoffs) {
            throw new HttpProxyResponseError({
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              data: errorText,
            });
          }
          await exponentialBackoffWithJitter(backoffCount);
          continue;
        }

        // Non-retriable HTTP error → surface as HttpProxyResponseError so callers
        // can handle uniformly and we do not retry in our catch block below.
        throw new HttpProxyResponseError({
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: errorText,
        });
      }

      const proxyResponse = (await response.json()) as HttpProxyResponse;

      if (categorizeHttpStatus(proxyResponse.status) === "temporary") {
        backoffCount += 1;
        if (backoffCount > maxBackoffs) {
          throw new HttpProxyResponseError(proxyResponse);
        }
        await exponentialBackoffWithJitter(backoffCount);
        continue;
      } else if (proxyResponse.status < 200 || proxyResponse.status >= 300) {
        // Log as error so callers see failure in console and can fail the sync
        console.error("HTTP proxy error:", {
          status: proxyResponse.status,
          statusText: proxyResponse.statusText,
          headers: proxyResponse.headers,
          data: proxyResponse.data,
        });
        throw new HttpProxyResponseError(proxyResponse);
      } else {
        // Redact secrets in logs
        console.debug("redacting keys", redactKeys);
        for (const key of redactKeys || []) {
          if (proxyResponse.data[key]) {
            console.debug(`Redacted key ${key} from response`);
          } else {
            console.debug(`key ${key} not found in response data`);
          }
        }
      }

      return proxyResponse;
    } catch (error) {
      // Treat any error that carries a proxy response as non-retriable
      if (isHttpProxyResponseError(error)) {
        throw error;
      }

      // If the proxy responded with an HTTP error (e.g., 4xx/422) and we
      // surfaced it as a generic Error string, do NOT retry.
      if (
        error instanceof Error &&
        error.message.startsWith("Proxy request failed:")
      ) {
        throw error;
      }

      // For non-HTTP errors, retry with exponential backoff
      if (backoffCount < maxBackoffs) {
        backoffCount += 1;
        await exponentialBackoffWithJitter(backoffCount);
        continue;
      }

      throw error;
    }
  } while (true);
};

// Batch HTTP implementation for async requests
export const batchHttpRequest: BatchHttpRequest = async (props) => {
  // Get environment variables
  const envName = process.env.ENV_NAME || "dev";
  const baseUrl = process.env.BASE_URL || "https://app.runlightyear.com";
  const apiKey = process.env.LIGHTYEAR_API_KEY || process.env.API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing API key. Set LIGHTYEAR_API_KEY or API_KEY environment variable."
    );
  }

  // Get the current run and execution context
  const { runId, syncId: contextSyncId } = getCurrentRunContext();

  // Use explicit syncId from props or fall back to context
  const effectiveSyncId = props.syncId || contextSyncId;

  if (!effectiveSyncId) {
    throw new Error(
      "Batch requests require a syncId. Either provide syncId in props or ensure sync context is set."
    );
  }

  const batchUrl = `${baseUrl}/api/v1/projects/default/envs/${envName}/http-request/batch`;

  // Prepare batch requests - convert to new API format
  const batchRequests = props.requests.map((request) => {
    const {
      headers: providedHeaders,
      body: providedBody,
      json: providedJson,
      data: providedData,
      params,
      url,
      syncInfo,
      ...restWithoutPayload
    } = request;

    let finalBody: string | undefined = providedBody;
    if (finalBody == null && providedJson !== undefined) {
      finalBody = JSON.stringify(providedJson);
    } else if (finalBody == null && providedData !== undefined) {
      finalBody = JSON.stringify(providedData);
    }

    const finalHeaders: Record<string, string> = {
      ...(providedHeaders || {}),
    };
    if (
      finalBody !== undefined &&
      !Object.keys(finalHeaders).some((h) => h.toLowerCase() === "content-type")
    ) {
      finalHeaders["Content-Type"] = "application/json";
    }

    // Append query params to URL
    let urlWithQuery = url;
    if (params && Object.keys(params).length > 0) {
      try {
        const u = new URL(urlWithQuery);
        for (const [key, value] of Object.entries(params)) {
          if (value === undefined || value === null) continue;
          u.searchParams.append(key, String(value));
        }
        urlWithQuery = u.toString();
      } catch {
        const qs = Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(
            ([k, v]) =>
              `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
          )
          .join("&");
        urlWithQuery = qs
          ? `${urlWithQuery}${urlWithQuery.includes("?") ? "&" : "?"}${qs}`
          : urlWithQuery;
      }
    }

    const batchRequest: any = {
      method: request.method || "POST",
      url: urlWithQuery,
      headers: finalHeaders,
      body: finalBody,
    };

    // Include syncInfo if provided
    if (syncInfo) {
      batchRequest.syncInfo = syncInfo;
    }

    return batchRequest;
  });

  console.debug("Making batch proxy request to:", batchUrl);
  console.debug(`Batch size: ${batchRequests.length}`);

  const response = await fetch(batchUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      syncId: effectiveSyncId,
      runId,
      requests: batchRequests,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Batch proxy request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const batchResponse = (await response.json()) as BatchHttpProxyResponse;
  return batchResponse;
};
