import { createServer, Server } from "http";
import { AddressInfo } from "net";

import { Command, Option, program } from "commander";
import { prompt } from "enquirer";
import open from "open";
import { terminal } from "terminal-kit";

import {
  OutputFormat,
  getEnvOption,
  readStdin,
  resolveEnvName,
  writeError,
  writeJson,
} from "../../shared/commandUtils";
import { getApiKey } from "../../shared/getApiKey";
import { getBaseUrl } from "../../shared/getBaseUrl";
import {
  checkResponseOk,
  parseJsonResponse,
} from "../../shared/parseJsonResponse";
import { requireAuth } from "../../shared/requireAuth";
import {
  getSupportedService,
  getSupportedServices,
} from "../../shared/services";

type AppAuthType = "APIKEY" | "OAUTH2" | "BASIC" | string;

type AppListResponse = {
  apps: Array<{
    id: string;
    name: string;
    title: string;
    authType: AppAuthType;
    auths: Array<{
      id: string;
      name: string;
      authorized: boolean;
      apiKeySet: boolean;
      isLinkedToAuth: boolean;
    }>;
  }>;
};

type AppDetailResponse = {
  id: string;
  name: string;
  title: string;
  authType: AppAuthType;
  auths: Array<{
    id: string;
    name: string;
    status: string;
    apiKeySet: boolean;
    passwordSet: boolean;
  }>;
};

type AuthorizeResponse = {
  authRequestUrl: string;
};

const DEFAULT_AUTH_NAME = "default";
const OAUTH_WAIT_TIMEOUT_MS = 5 * 60 * 1000;

export const auth = new Command("auth")
  .description("Connect and manage app credentials")
  .addHelpText(
    "after",
    `\nKnown services: ${getSupportedServices()
      .map((service) => service.name)
      .join(", ")}

Examples:
  unscrambled auth list --env dev
  unscrambled auth add hubspot --env prod
  unscrambled auth add salesforce --env prod --api-key "$SALESFORCE_API_KEY"
  cat api-key.txt | unscrambled auth add hubspot --env prod --stdin
  unscrambled auth remove hubspot --env prod
`
  );

function getRequiredApiKey(): string {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Authentication required");
  }
  return apiKey;
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

async function fetchAppDetail(
  envName: string,
  serviceName: string
): Promise<AppDetailResponse | null> {
  const response = await fetch(
    `${getBaseUrl()}/api/v1/projects/default/envs/${envName}/apps/${serviceName}`,
    {
      headers: {
        Authorization: `Bearer ${getRequiredApiKey()}`,
      },
    }
  );

  if (response.status === 404) {
    return null;
  }

  return await readApiResponse<AppDetailResponse>(
    response,
    `get ${serviceName} app details`
  );
}

async function fetchApps(envName: string): Promise<AppListResponse> {
  const response = await fetch(
    `${getBaseUrl()}/api/v1/projects/default/envs/${envName}/apps`,
    {
      headers: {
        Authorization: `Bearer ${getRequiredApiKey()}`,
      },
    }
  );

  return await readApiResponse<AppListResponse>(response, "list apps");
}

function resolveAuthName(auths: Array<{ name: string }>): string {
  const defaultAuth = auths.find((auth) => auth.name === DEFAULT_AUTH_NAME);
  if (defaultAuth) {
    return defaultAuth.name;
  }

  if (auths.length === 1) {
    return auths[0].name;
  }

  if (auths.length === 0) {
    return DEFAULT_AUTH_NAME;
  }

  throw new Error(
    `Multiple auths are configured for this service. Re-run with a single '${DEFAULT_AUTH_NAME}' auth or remove the extras in the web app.`
  );
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function createOAuthCallbackServer(serviceTitle: string): Promise<{
  redirectUrl: string;
  waitForRedirect: Promise<void>;
  close: () => Promise<void>;
}> {
  let redirectUrl = "";
  let resolveRedirect!: () => void;
  let rejectRedirect!: (error: Error) => void;

  const waitForRedirect = new Promise<void>((resolve, reject) => {
    resolveRedirect = resolve;
    rejectRedirect = reject;
  });

  const server = createServer((req, res) => {
    const requestUrl = new URL(
      req.url ?? "/",
      redirectUrl || "http://127.0.0.1"
    );

    if (requestUrl.pathname === "/favicon.ico") {
      res.statusCode = 204;
      res.end();
      return;
    }

    const errorParam = requestUrl.searchParams.get("error");
    const status = requestUrl.searchParams.get("status");
    const isError = Boolean(errorParam) || status === "error";

    res.statusCode = isError ? 400 : 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      isError
        ? `<html><body><h1>${serviceTitle} authorization failed</h1><p>Return to the terminal for details.</p></body></html>`
        : `<html><body><h1>${serviceTitle} connected</h1><p>You can close this window and return to the terminal.</p></body></html>`
    );

    if (isError) {
      rejectRedirect(
        new Error(
          errorParam
            ? `${serviceTitle} authorization failed: ${errorParam}`
            : `${serviceTitle} authorization failed`
        )
      );
    } else {
      resolveRedirect();
    }

    setImmediate(() => {
      void closeServer(server);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo | null;
  if (!address) {
    await closeServer(server);
    throw new Error("Failed to start local OAuth callback server");
  }

  redirectUrl = `http://127.0.0.1:${address.port}/`;

  return {
    redirectUrl,
    waitForRedirect,
    close: async () => closeServer(server),
  };
}

async function waitForOAuthRedirect(
  serviceTitle: string,
  waitForRedirect: Promise<void>
): Promise<void> {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      waitForRedirect,
      new Promise<void>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `Timed out waiting for ${serviceTitle} authorization. Finish the browser flow and try again.`
            )
          );
        }, OAUTH_WAIT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function authorizeOAuthService(
  envName: string,
  serviceName: string,
  serviceTitle: string,
  authName: string
): Promise<void> {
  const callbackServer = await createOAuthCallbackServer(serviceTitle);

  try {
    const response = await fetch(
      `${getBaseUrl()}/api/v1/projects/default/envs/${envName}/apps/${serviceName}/auths/${authName}/authorize`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getRequiredApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ redirectUrl: callbackServer.redirectUrl }),
      }
    );

    const data = await readApiResponse<AuthorizeResponse>(
      response,
      `authorize ${serviceName}`
    );

    if (!data.authRequestUrl) {
      throw new Error(
        `Authorize ${serviceName} failed: missing authRequestUrl`
      );
    }

    terminal(`Opening your browser to connect ${serviceTitle}\n`);
    await open(data.authRequestUrl);
    terminal(`Waiting for ${serviceTitle} authorization to complete...\n`);

    await waitForOAuthRedirect(serviceTitle, callbackServer.waitForRedirect);

    terminal.green(`${serviceTitle} connected successfully in ${envName}.\n`);
  } finally {
    await callbackServer.close();
  }
}

async function authorizeApiKeyService(
  envName: string,
  serviceName: string,
  serviceTitle: string,
  authName: string,
  options: {
    apiKey?: string;
    stdin?: boolean;
  }
): Promise<void> {
  if (options.apiKey && options.stdin) {
    throw new Error("Use either --api-key or --stdin, not both.");
  }

  let apiKey = options.apiKey?.trim();
  if (!apiKey && options.stdin) {
    apiKey = (await readStdin()).trim();
  }

  if (!apiKey) {
    const answers = (await prompt({
      type: "password",
      name: "apiKey",
      message: `Enter your ${serviceTitle} API key`,
    })) as { apiKey?: string };
    apiKey = answers.apiKey?.trim();
  }

  if (!apiKey) {
    throw new Error("API key is required");
  }

  const response = await fetch(
    `${getBaseUrl()}/api/v1/projects/default/envs/${envName}/apps/${serviceName}/auths/${authName}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${getRequiredApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ apiKey }),
    }
  );

  await readApiResponse<Record<string, unknown>>(
    response,
    `save ${serviceName} API key`
  );

  terminal.green(`${serviceTitle} connected successfully in ${envName}.\n`);
}

function formatUnknownServiceMessage(serviceName: string): string {
  const knownServices = getSupportedServices()
    .map((service) => service.name)
    .join(", ");

  return `Unknown service '${serviceName}'. Known services: ${knownServices}`;
}

auth
  .command("add")
  .description("Connect a service in the current environment")
  .argument("<service>", "Service name, for example hubspot or salesforce")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(
    new Option("--api-key <value>", "API key for API-key based services")
  )
  .addOption(new Option("--stdin", "Read API key from stdin"))
  .action(
    async (
      rawServiceName: string,
      options: {
        env?: string;
        environment?: string;
        apiKey?: string;
        stdin?: boolean;
      }
    ) => {
      requireAuth();

      try {
        const envName = resolveEnvName(getEnvOption(options));
        const serviceName = rawServiceName.toLowerCase();
        const knownService = getSupportedService(serviceName);
        const app = await fetchAppDetail(envName, serviceName);

        if (!app) {
          throw new Error(
            knownService
              ? `${knownService.title} is not available in environment '${envName}' yet.`
              : formatUnknownServiceMessage(serviceName)
          );
        }

        const authName = resolveAuthName(app.auths);

        if (app.authType === "OAUTH2") {
          await authorizeOAuthService(
            envName,
            serviceName,
            app.title,
            authName
          );
          return;
        }

        if (app.authType === "APIKEY") {
          await authorizeApiKeyService(
            envName,
            serviceName,
            app.title,
            authName,
            options
          );
          return;
        }

        throw new Error(
          `${app.title} uses unsupported auth type '${app.authType}' for this command.`
        );
      } catch (error) {
        writeError(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    }
  );

auth
  .command("list")
  .description("List service credentials in the current environment")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (options: {
      env?: string;
      environment?: string;
      output: OutputFormat;
    }) => {
      requireAuth();

      try {
        const envName = resolveEnvName(getEnvOption(options));
        const result = await fetchApps(envName);

        const auths = result.apps
          .filter((app) => app.auths.length > 0)
          .flatMap((app) =>
            app.auths.map((auth) => ({
              service: app.name,
              authName: auth.name,
              authType: app.authType,
              status: auth.authorized
                ? "connected"
                : auth.isLinkedToAuth
                ? "linked"
                : auth.apiKeySet
                ? "configured"
                : "pending",
            }))
          )
          .sort((a, b) => a.service.localeCompare(b.service));

        if (options.output === "json") {
          writeJson({ auths });
          return;
        }

        if (auths.length === 0) {
          terminal(`No service credentials found in ${envName}.\n`);
          return;
        }

        terminal.bold(`Service Credentials (${envName}):\n\n`);
        for (const item of auths) {
          terminal.bold(`${item.service.padEnd(14)}`);
          terminal(` ${item.status.padEnd(10)} ${item.authType}`);
          if (item.authName !== DEFAULT_AUTH_NAME) {
            terminal.gray(` (${item.authName})`);
          }
          terminal(`\n`);
        }
      } catch (error) {
        writeError(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    }
  );

auth
  .command("remove")
  .description("Remove stored credentials for a service")
  .argument("<service>", "Service name, for example hubspot or salesforce")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .action(
    async (
      rawServiceName: string,
      options: { env?: string; environment?: string }
    ) => {
      requireAuth();

      try {
        const envName = resolveEnvName(getEnvOption(options));
        const serviceName = rawServiceName.toLowerCase();
        const knownService = getSupportedService(serviceName);
        const app = await fetchAppDetail(envName, serviceName);

        if (!app) {
          throw new Error(
            knownService
              ? `${knownService.title} is not available in environment '${envName}' yet.`
              : formatUnknownServiceMessage(serviceName)
          );
        }

        if (app.auths.length === 0) {
          terminal(`${app.title} is not connected in ${envName}.\n`);
          return;
        }

        const authName = resolveAuthName(app.auths);
        const response = await fetch(
          `${getBaseUrl()}/api/v1/projects/default/envs/${envName}/apps/${serviceName}/auths/${authName}/deauthorize`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${getRequiredApiKey()}`,
            },
          }
        );

        await readApiResponse<Record<string, unknown>>(
          response,
          `deauthorize ${serviceName}`
        );

        terminal.green(`${app.title} credentials removed from ${envName}.\n`);
      } catch (error) {
        writeError(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    }
  );
