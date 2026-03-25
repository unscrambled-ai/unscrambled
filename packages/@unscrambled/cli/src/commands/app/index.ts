import { Command, Option, program } from "commander";
import { terminal } from "terminal-kit";

import { getApiKey } from "../../shared/getApiKey";
import { getBaseUrl } from "../../shared/getBaseUrl";
import { getEnvName } from "../../shared/getEnvName";
import {
  checkResponseOk,
  parseJsonResponse,
} from "../../shared/parseJsonResponse";
import { requireAuth } from "../../shared/requireAuth";
import { getSupportedServices } from "../../shared/services";

type OutputFormat = "text" | "json";
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface AppRequestResponse {
  status: number;
  statusText: string;
  headers?: Record<string, string>;
  data?: unknown;
  httpRequestId?: string;
}

type AppRequestOptions = {
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

export const app = new Command("app")
  .description("Inspect apps and make authorized app requests")
  .addHelpText(
    "after",
    `\nKnown services: ${getSupportedServices()
      .map((service) => service.name)
      .join(", ")}\n`
  );

function resolveEnvName(cliEnv?: string): string {
  if (cliEnv) return cliEnv;
  const globalEnv = program.opts().env;
  if (globalEnv) return globalEnv;
  return getEnvName();
}

function getEnvOption(options: { env?: string; environment?: string }): string | undefined {
  return options.env ?? options.environment;
}

function parseKeyValuePair(
  input: string,
  separator: string,
  label: string
): { key: string; value: string } {
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

export function parseQueryOption(input: string): { key: string; value: string } {
  return parseKeyValuePair(input, "=", "--query");
}

export function parseHeaderOption(
  input: string
): { key: string; value: string } {
  return parseKeyValuePair(input, ":", "--header");
}

export function buildAppRequestPayload(options: AppRequestOptions): {
  method: HttpMethod;
  path: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string;
  json?: unknown;
} {
  if (options.json && options.body) {
    throw new Error("Use either --json or --body, not both");
  }

  let parsedJson: unknown;
  if (options.json) {
    try {
      parsedJson = JSON.parse(options.json);
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
      ? Object.fromEntries(options.query.map((entry) => [entry.key, entry.value]))
      : undefined;
  const headers =
    options.header.length > 0
      ? Object.fromEntries(
          options.header.map((entry) => [entry.key, entry.value])
        )
      : undefined;

  return {
    method: options.method,
    path: options.path,
    query,
    headers,
    body: options.body,
    json: parsedJson,
  };
}

function formatResponseBody(data: unknown): string {
  if (data == null) {
    return "";
  }

  if (typeof data === "string") {
    return data;
  }

  return JSON.stringify(data, null, 2);
}

async function readApiResponse<T>(
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
  .addOption(new Option("--path <path>", "Provider API path").makeOptionMandatory())
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
      const payload = buildAppRequestPayload(options);

      const response = await fetch(
        `${baseUrl}/api/v1/projects/default/envs/${envName}/apps/${appName}/request`,
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
