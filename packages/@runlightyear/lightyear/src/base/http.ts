import baseRequest from "./baseRequest";
import { prefixedRedactedConsole } from "../logging";
import { sleep } from "../util/sleep";
import { getEnvName } from "../util/getEnvName";
import { getContext } from "./context";

/**
 * @public
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpProxyRequestHeaders {
  [key: string]: string;
}

/**
 * @deprecated Use syncInfo instead
 */
export interface HttpProxyRequestConfirm {
  changeIds?: string[];
  idPath?: string;
  updatedAtPath?: string;
}

/**
 * @public
 */
export interface HttpProxyRequestProps {
  method?: HttpMethod;
  url: string;
  params?: Record<string, any>;
  headers?: HttpProxyRequestHeaders;
  data?: object;
  body?: string;
  redactKeys?: string[];
  maxRetries?: number;
  async?: boolean;
  /**
   * @deprecated Use syncInfo instead
   */
  confirm?: HttpProxyRequestConfirm;
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
  // return error instanceof HttpProxyResponseError;
  return !!error && typeof error === "object" && "response" in error;
}

export interface HttpRequest {
  (props: HttpProxyRequestProps): Promise<HttpProxyResponse>;
}

export interface HttpRequestBatchResponse {
  batchId: string;
}

export interface HttpRequestBatch {
  (
    requests: Array<HttpProxyRequestProps>,
    syncId?: string
  ): Promise<HttpRequestBatchResponse>;
}

function getRandomJitter(maxJitter: number): number {
  return Math.floor(Math.random() * maxJitter);
}
async function exponentialBackoffWithJitter(retryCount: number): Promise<void> {
  const baseWaitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
  const jitter = getRandomJitter(5000); // Add up to 5 seconds of jitter
  const waitTime = baseWaitTime + jitter;
  console.log(`Retrying in ${(waitTime / 1000).toFixed(2)} seconds...`);
  await sleep(waitTime);
}

export const httpRequest: HttpRequest = async (props) => {
  const envName = getEnvName();
  const { runId } = getContext();
  const {
    redactKeys,
    maxRetries,
    managedUserId,
    managedUserExternalId,
    ...rest
  } = props;

  const maxBackoffs = 5;
  let backoffCount = 0;

  // Only send one of managedUserId or managedUserExternalId (API doesn't allow both)
  const authParams: any = {};
  if (managedUserExternalId) {
    authParams.managedUserExternalId = managedUserExternalId;
  } else if (managedUserId) {
    authParams.managedUserId = managedUserId;
  }

  do {
    const response = await baseRequest({
      uri: `/api/v1/projects/default/envs/${envName}/http-request`,
      data: { ...rest, ...authParams, runId },
      maxRetries,
    });

    const proxyResponse = (await response.json()) as HttpProxyResponse;

    if (proxyResponse.status === 429) {
      backoffCount += 1;
      if (backoffCount > maxBackoffs) {
        throw new HttpProxyResponseError(proxyResponse);
      }
      await exponentialBackoffWithJitter(backoffCount);
      continue;
    } else if (proxyResponse.status < 200 || proxyResponse.status >= 300) {
      throw new HttpProxyResponseError(proxyResponse);
    } else {
      console.debug("redacting keys", redactKeys);
      for (const key of redactKeys || []) {
        if (proxyResponse.data[key]) {
          prefixedRedactedConsole.addSecrets([proxyResponse.data[key]]);
        } else {
          console.debug(`key ${key} not found in response data`);
        }
      }
    }

    return proxyResponse;
  } while (true);
};

export const httpRequestBatch: HttpRequestBatch = async (
  requests,
  explicitSyncId?
) => {
  const envName = getEnvName();
  const { runId, syncId: contextSyncId } = getContext();

  // Use explicit syncId or fall back to context
  const effectiveSyncId = explicitSyncId || (contextSyncId as any);

  if (!effectiveSyncId) {
    throw new Error(
      "Batch requests require a syncId. Either provide it as a parameter or ensure sync context is set."
    );
  }

  // Convert requests to new API format
  const batchRequests = requests.map((request) => ({
    method: request.method || "POST",
    url: request.url,
    headers: request.headers,
    body: request.body,
    syncInfo: request.syncInfo,
  }));

  const response = await baseRequest({
    uri: `/api/v1/projects/default/envs/${envName}/http-request/batch`,
    data: { runId, syncId: effectiveSyncId, requests: batchRequests },
  });

  const batchResponse = (await response.json()) as HttpRequestBatchResponse;

  return batchResponse;
};
