import { checkResponseOk, parseJsonResponse } from "./parseJsonResponse";

export type HttpRequestOutputFormat = "text" | "json";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface AuthorizedRequestResponse {
  status: number;
  statusText: string;
  headers?: Record<string, string>;
  data?: unknown;
  httpRequestId?: string;
}

type KeyValuePair = { key: string; value: string };

export interface AuthorizedRequestPayloadOptions {
  appName?: string;
  customAppName?: string;
  authName?: string;
  method: HttpMethod;
  baseUrl?: string;
  path?: string;
  url?: string;
  query: KeyValuePair[];
  header: KeyValuePair[];
  json?: string;
  body?: string;
}

function resolveAuthorizedRequestTarget(
  options: AuthorizedRequestPayloadOptions
): { path?: string; url?: string } {
  if (!options.path && !options.url) {
    throw new Error("Either path or url is required");
  }

  if (options.url && options.path) {
    throw new Error("Specify either path or url, not both");
  }

  if (options.url && options.baseUrl) {
    throw new Error("Specify either baseUrl or url, not both");
  }

  if (options.baseUrl && !options.path) {
    throw new Error("When using baseUrl, path is required");
  }

  if (options.url) {
    return { url: options.url };
  }

  if (!options.baseUrl) {
    return { path: options.path };
  }

  try {
    return { url: new URL(options.path!, options.baseUrl).toString() };
  } catch (error) {
    throw new Error(
      `Invalid request URL: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function parseKeyValuePair(
  input: string,
  separator: string,
  label: string
): KeyValuePair {
  const separatorIndex = input.indexOf(separator);
  if (separatorIndex <= 0) {
    throw new Error(`${label} must be in the form key${separator}value`);
  }

  const key = input.slice(0, separatorIndex).trim();
  const value = input.slice(separatorIndex + separator.length).trim();
  if (!key) {
    throw new Error(`${label} key cannot be empty`);
  }

  return { key, value };
}

export function parseQueryOption(input: string): KeyValuePair {
  return parseKeyValuePair(input, "=", "--query");
}

export function parseHeaderOption(input: string): KeyValuePair {
  return parseKeyValuePair(input, ":", "--header");
}

export function buildAuthorizedRequestPayload(
  options: AuthorizedRequestPayloadOptions
): Record<string, unknown> {
  if (!options.appName && !options.customAppName) {
    throw new Error("Either appName or customAppName is required");
  }

  if (options.appName && options.customAppName) {
    throw new Error("Specify either appName or customAppName, not both");
  }

  if (options.json && options.body) {
    throw new Error("Use either --json or --body, not both");
  }

  const requestTarget = resolveAuthorizedRequestTarget(options);

  let body = options.body;
  if (options.json) {
    try {
      const parsedJson = JSON.parse(options.json);
      body = JSON.stringify(parsedJson);
    } catch (error) {
      throw new Error(
        `Invalid JSON provided to --json: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  const query =
    options.query.length > 0
      ? Object.fromEntries(
          options.query.map((entry) => [entry.key, entry.value])
        )
      : undefined;
  const headers =
    options.header.length > 0
      ? Object.fromEntries(
          options.header.map((entry) => [entry.key, entry.value])
        )
      : undefined;

  if (
    options.json &&
    headers &&
    !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")
  ) {
    headers["Content-Type"] = "application/json";
  }

  return {
    ...(options.appName ? { appName: options.appName } : {}),
    ...(options.customAppName ? { customAppName: options.customAppName } : {}),
    ...(options.authName ? { authName: options.authName } : {}),
    method: options.method,
    ...requestTarget,
    query,
    headers,
    body,
  };
}

export function formatResponseBody(data: unknown): string {
  if (data == null) {
    return "";
  }

  if (typeof data === "string") {
    return data;
  }

  return JSON.stringify(data, null, 2);
}

export async function readApiResponse<T>(
  response: Response,
  operationName: string
): Promise<T> {
  const data = (await parseJsonResponse(response, {
    operationName,
  })) as Record<string, unknown>;

  if (!response.ok) {
    checkResponseOk(response, operationName);
    const message =
      typeof data?.message === "string"
        ? data.message
        : `${operationName} failed: HTTP ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return data as T;
}
