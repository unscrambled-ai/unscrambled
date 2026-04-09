import { Command, Option } from "commander";
import { terminal } from "terminal-kit";

import { getEnvOption, resolveEnvName } from "../../shared/commandUtils";
import { getApiKey } from "../../shared/getApiKey";
import { getBaseUrl } from "../../shared/getBaseUrl";
import {
  type AuthorizedRequestResponse as AppRequestResponse,
  type HttpMethod,
  type HttpRequestOutputFormat as OutputFormat,
  buildAuthorizedRequestPayload,
  formatResponseBody,
  parseHeaderOption,
  parseQueryOption,
  readApiResponse,
} from "../../shared/httpRequestCommand";
import { requireAuth } from "../../shared/requireAuth";
import { getSupportedServices } from "../../shared/services";

type AppRequestOptions = {
  appName?: string;
  env?: string;
  environment?: string;
  method: HttpMethod;
  path: string;
  query: Array<{ key: string; value: string }>;
  header: Array<{ key: string; value: string }>;
  json?: string;
  body?: string;
  output: OutputFormat;
};

export { parseHeaderOption, parseQueryOption };

export function buildAppRequestPayload(options: AppRequestOptions): {
  appName: string;
  method: HttpMethod;
  path: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string;
} {
  if (!options.appName) {
    throw new Error("appName is required");
  }

  return buildAuthorizedRequestPayload(options) as {
    appName: string;
    method: HttpMethod;
    path: string;
    query?: Record<string, string>;
    headers?: Record<string, string>;
    body?: string;
  };
}

export const app = new Command("app")
  .description("Inspect apps and make authorized app requests")
  .addHelpText(
    "after",
    `\nKnown services: ${getSupportedServices()
      .map((service) => service.name)
      .join(", ")}

Examples:
  unscrambled app request hubspot --env prod --path /crm/v3/objects/contacts --method GET
  unscrambled app request salesforce --env prod --path /services/data/v60.0/sobjects/Account --method GET --output json
`
  );

app
  .command("request")
  .description("Make an authenticated request through an app connection")
  .argument("<appName>", "App name, for example hubspot or salesforce")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(
    new Option("-X, --method <method>", "HTTP method")
      .choices(["GET", "POST", "PUT", "PATCH", "DELETE"])
      .default("GET")
  )
  .addOption(
    new Option("--path <path>", "Provider API path").makeOptionMandatory()
  )
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
  .action(async (appName: string, options: AppRequestOptions) => {
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
      const payload = buildAppRequestPayload({
        ...options,
        appName,
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

      const result = await readApiResponse<AppRequestResponse>(
        response,
        `request ${appName}`
      );
      result.httpRequestId =
        response.headers.get("x-http-request-id") ??
        response.headers.get("X-Http-Request-Id") ??
        undefined;

      if (options.output === "json") {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }

      terminal.bold(`${appName} response (${envName}):\n\n`);
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
