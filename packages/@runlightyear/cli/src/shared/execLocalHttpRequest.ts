import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";
import { parseJsonResponse } from "./parseJsonResponse";

export interface ExecLocalHttpRequestProps {
  httpRequestId: string;
}

interface ProxyResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

interface ProxyError {
  error: string;
  errorDetail?: string;
}

export async function execLocalHttpRequest(props: ExecLocalHttpRequestProps) {
  const { httpRequestId } = props;
  const baseUrl = getBaseUrl();
  const envName = getEnvName();
  const apiKey = getApiKey();

  let url = "unknown";

  try {
    // 1. Fetch request details
    const requestResponse = await fetch(
      `${baseUrl}/api/v1/projects/default/envs/${envName}/http-requests/${httpRequestId}/raw`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!requestResponse.ok) {
      throw new Error(
        `Failed to fetch request: ${requestResponse.status} ${requestResponse.statusText}`
      );
    }

    const httpRequest = await parseJsonResponse(requestResponse, {
      operationName: "fetch http request",
    });

    console.warn("[localhost-proxy] Received from /raw endpoint:");
    console.warn(JSON.stringify(httpRequest, null, 2));

    // 2. Execute localhost request
    const { method, requestHeaders, requestBody } = httpRequest;
    url = httpRequest.url;

    console.warn("[localhost-proxy] Request to localhost:");
    console.warn("  Method:", method);
    console.warn("  URL:", url);
    console.warn("  Headers:", JSON.stringify(requestHeaders, null, 2));
    console.warn("  Body:", requestBody);

    const localResponse = await fetch(url, {
      method,
      headers: requestHeaders || {},
      body: requestBody || undefined,
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });

    // 3. Prepare response
    const responseBody = await localResponse.text();
    const responseHeaders: Record<string, string> = {};
    localResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // 4. Send response back
    await sendProxyResponse(httpRequestId, {
      statusCode: localResponse.status,
      statusText: localResponse.statusText,
      headers: responseHeaders,
      body: responseBody,
    });

    console.info(
      `[localhost-proxy] ${method} ${url} → ${localResponse.status}`
    );
  } catch (error: any) {
    console.info(`[localhost-proxy] ${url} → ERROR: ${error.message}`);

    await sendProxyResponse(httpRequestId, {
      error: error.message || "Unknown error",
      errorDetail: error.stack || String(error),
    });
  }
}

async function sendProxyResponse(
  httpRequestId: string,
  response: ProxyResponse | ProxyError
) {
  const baseUrl = getBaseUrl();
  const envName = getEnvName();
  const apiKey = getApiKey();

  console.debug(
    `[localhost-proxy] Sending response:`,
    JSON.stringify(response, null, 2)
  );

  const deliveryResponse = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/http-requests/${httpRequestId}/dev-proxy-response`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(response),
    }
  );

  if (!deliveryResponse.ok) {
    const errorText = await deliveryResponse.text();
    console.error(
      `[localhost-proxy] Failed to deliver response for ${httpRequestId}:`,
      deliveryResponse.status,
      deliveryResponse.statusText,
      errorText
    );
  }
}
