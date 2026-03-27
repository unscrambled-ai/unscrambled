import { Command, Option } from "commander";
import { terminal } from "terminal-kit";

import {
  getEnvOption,
  resolveEnvName,
} from "../../shared/commandUtils";
import { getApiKey } from "../../shared/getApiKey";
import { getBaseUrl } from "../../shared/getBaseUrl";
import {
  type AuthorizedRequestResponse,
  type HttpMethod,
  type HttpRequestOutputFormat as OutputFormat,
  buildAuthorizedRequestPayload,
  formatResponseBody,
  parseHeaderOption,
  parseQueryOption,
  readApiResponse,
} from "../../shared/httpRequestCommand";
import { requireAuth } from "../../shared/requireAuth";

type CustomAppRequestOptions = {
  customAppName?: string;
  env?: string;
  environment?: string;
  method: HttpMethod;
  auth?: string;
  url?: string;
  baseUrl?: string;
  path?: string;
  query: Array<{ key: string; value: string }>;
  header: Array<{ key: string; value: string }>;
  json?: string;
  body?: string;
  output: OutputFormat;
};

const CUSTOM_APP_AUTH_TEMPLATE_PATTERNS = [
  /\{\{\s*(?:accessToken|refreshToken|apiKey|username|password)\s*\}\}/,
  /\{\{\s*extraData\.[^}]+\}\}/,
  /\{\{\s*basicAuth\b[^}]*\}\}/,
];

export function hasCustomAppAuthTemplate(
  headers: Record<string, string> | undefined
): boolean {
  if (!headers) {
    return false;
  }

  return Object.values(headers).some((value) =>
    CUSTOM_APP_AUTH_TEMPLATE_PATTERNS.some((pattern) => pattern.test(value))
  );
}

export function resolveCustomAppRequestUrl(
  options: CustomAppRequestOptions
): string {
  if (options.url && options.path) {
    throw new Error("Use either --url or --path, not both.");
  }

  if (options.url && options.baseUrl) {
    throw new Error("Use either --url or --base-url, not both.");
  }

  if (options.url) {
    return options.url;
  }

  if (!options.path) {
    throw new Error(
      "Missing request target. Use --url <url> or --base-url <baseUrl> --path <path>."
    );
  }

  if (!options.baseUrl) {
    throw new Error(
      "When using --path for a custom app request, also provide --base-url <baseUrl>."
    );
  }

  try {
    return new URL(options.path, options.baseUrl).toString();
  } catch (error) {
    throw new Error(
      `Invalid custom app request URL: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function buildCustomAppRequestPayload(
  options: CustomAppRequestOptions
): {
  customAppName: string;
  authName?: string;
  method: HttpMethod;
  url: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string;
} {
  if (!options.customAppName) {
    throw new Error("customAppName is required");
  }

  const payload = buildAuthorizedRequestPayload({
    ...options,
    authName: options.auth,
    url: resolveCustomAppRequestUrl(options),
  }) as {
    customAppName: string;
    authName?: string;
    method: HttpMethod;
    url: string;
    query?: Record<string, string>;
    headers?: Record<string, string>;
    body?: string;
  };

  if (!hasCustomAppAuthTemplate(payload.headers)) {
    throw new Error(
      "Custom app requests must include an auth header template such as 'Authorization: Bearer {{ accessToken }}', 'X-API-Key: {{ apiKey }}', or 'Authorization: {{basicAuth username password}}'."
    );
  }

  return payload;
}

export const customApp = new Command("custom-app")
  .description("Make authorized requests through custom app connections")
  .addHelpText(
    "after",
    `
Examples:
  unscrambled custom-app request granola --env prod --url https://api.granola.ai/v1/notes --header "Authorization: Bearer {{ accessToken }}"
  unscrambled custom-app request granola --env prod --url https://api.granola.ai/v1/notes --header "X-API-Key: {{ apiKey }}"
  unscrambled custom-app request granola --env prod --base-url https://api.granola.ai --path /v1/notes --header "Authorization: {{basicAuth username password}}" --output json
`
  );

customApp
  .command("request")
  .description("Make an authenticated request through a custom app connection")
  .argument("<customAppName>", "Custom app name")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(
    new Option("-X, --method <method>", "HTTP method")
      .choices(["GET", "POST", "PUT", "PATCH", "DELETE"])
      .default("GET")
  )
  .option(
    "--auth <authName>",
    "Auth name to use when the custom app has multiple auths"
  )
  .option("--url <url>", "Full provider API URL")
  .option("--base-url <baseUrl>", "Base provider API URL")
  .option("--path <path>", "Provider API path")
  .option(
    "--query <key=value>",
    "Query parameter, can be repeated",
    (value: string, previous: Array<{ key: string; value: string }>) => [
      ...previous,
      parseQueryOption(value),
    ],
    []
  )
  .option(
    "--header <name:value>",
    "Header, can be repeated",
    (value: string, previous: Array<{ key: string; value: string }>) => [
      ...previous,
      parseHeaderOption(value),
    ],
    []
  )
  .option("--json <json>", "JSON request body")
  .option("--body <string>", "Raw request body")
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(async (customAppName: string, options: CustomAppRequestOptions) => {
    requireAuth();

    let envName: string;
    try {
      envName = resolveEnvName(getEnvOption(options));
    } catch (error) {
      terminal.red(
        `${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exitCode = 1;
      return;
    }

    try {
      const baseUrl = getBaseUrl();
      const apiKey = getApiKey();
      const payload = buildCustomAppRequestPayload({
        ...options,
        customAppName,
      });

      const response = await fetch(
        `${baseUrl}/api/v1/projects/default/envs/${envName}/http-request`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await readApiResponse<AuthorizedRequestResponse>(
        response,
        `request ${customAppName}`
      );
      result.httpRequestId =
        response.headers.get("x-http-request-id") ??
        response.headers.get("X-Http-Request-Id") ??
        undefined;

      if (options.output === "json") {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }

      terminal.bold(`${customAppName} response (${envName}):\n\n`);
      terminal(`Status: ${result.status} ${result.statusText}\n`);
      if (result.httpRequestId) {
        terminal.gray(`HTTP Request ID: ${result.httpRequestId}\n`);
      }

      const body = formatResponseBody(result.data);
      if (body) {
        terminal("\n");
        terminal(`${body}\n`);
      }
    } catch (error) {
      terminal.red(
        `${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exitCode = 1;
    }
  });
