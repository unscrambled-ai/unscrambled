import { Command, Option, program } from "commander";
import { terminal } from "terminal-kit";

import { requireAuth } from "../../shared/requireAuth";
import { getApiKey } from "../../shared/getApiKey";
import { getBaseUrl } from "../../shared/getBaseUrl";
import { getEnvName } from "../../shared/getEnvName";
import { checkResponseOk, parseJsonResponse } from "../../shared/parseJsonResponse";

type OutputFormat = "text" | "json";

function resolveEnvName(cliEnv?: string): string {
  if (cliEnv) return cliEnv;
  const globalEnv = program.opts().env;
  if (globalEnv) return globalEnv;
  return getEnvName();
}

function getEnvOption(options: any): string | undefined {
  return options?.env ?? options?.environment;
}

export const managedUsers = new Command("managed-users").description(
  "Manage and inspect managed users"
);

// List managed users
managedUsers
  .command("list")
  .description("List all managed users")
  .addOption(new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)"))
  .addOption(new Option("-l, --limit <count>", "Max number of users to return").default("20"))
  .addOption(new Option("--count-only", "Only return the count"))
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (options: {
      env?: string;
      environment?: string;
      limit: string;
      countOnly?: boolean;
      output: OutputFormat;
    }) => {
      requireAuth();

      let envName: string;
      try {
        envName = resolveEnvName(getEnvOption(options));
      } catch (error) {
        terminal.red(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
        return;
      }

      try {
        const baseUrl = getBaseUrl();
        const apiKey = getApiKey();

        const params = new URLSearchParams();
        if (options.countOnly) params.set("countOnly", "true");
        params.set("take", options.limit);

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/managed-users?${params}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          checkResponseOk(response, "List managed users");
          throw new Error(`List managed users failed: HTTP ${response.status} ${response.statusText}`);
        }

        const result = await parseJsonResponse(response, { operationName: "list managed users" });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          if (options.countOnly || result.count !== undefined) {
            terminal(`Count: ${result.count}\n`);
            return;
          }

          const users = result.managedUsers ?? [];
          if (users.length === 0) {
            terminal("No managed users found\n");
            return;
          }

          terminal.bold(`Managed Users:\n\n`);
          for (const user of users) {
            terminal.bold(`${user.displayName}\n`);
            terminal(`  ID: ${user.id}\n`);
            terminal(`  External ID: ${user.externalId}\n`);
            terminal.gray(`  Created: ${user.createdAt}\n`);
            if (user.integrations && user.integrations.length > 0) {
              terminal(`  Integrations: ${user.integrations.map((i: any) => i.name).join(", ")}\n`);
            }
            terminal("\n");
          }

          terminal(`Total: ${users.length} managed user(s)\n`);
          if (result.cursor) {
            terminal.gray(`(more available)\n`);
          }
        }
      } catch (error) {
        terminal.red(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  );

// Get a single managed user by ID or external ID
managedUsers
  .command("get")
  .description("Get a managed user by ID or external ID")
  .argument("<id>", "Managed user ID (UUID) or external ID")
  .addOption(new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)"))
  .addOption(new Option("-x, --external", "Treat the ID as an external ID"))
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (
      id: string,
      options: { env?: string; environment?: string; external?: boolean; output: OutputFormat }
    ) => {
      requireAuth();

      let envName: string;
      try {
        envName = resolveEnvName(getEnvOption(options));
      } catch (error) {
        terminal.red(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
        return;
      }

      try {
        const baseUrl = getBaseUrl();
        const apiKey = getApiKey();

        // Determine if this is an external ID or internal ID
        const isExternalId = options.external || !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

        let url: string;
        if (isExternalId) {
          url = `${baseUrl}/api/v1/projects/default/envs/${envName}/managed-users/external-id/${encodeURIComponent(id)}`;
        } else {
          url = `${baseUrl}/api/v1/projects/default/envs/${envName}/managed-users/${id}`;
        }

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            terminal.red(`Managed user '${id}' not found\n`);
            process.exitCode = 1;
            return;
          }
          checkResponseOk(response, "Get managed user");
          throw new Error(`Get managed user failed: HTTP ${response.status} ${response.statusText}`);
        }

        const user = await parseJsonResponse(response, { operationName: "get managed user" });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(user, null, 2)}\n`);
        } else {
          terminal.bold(`Managed User: ${user.displayName}\n\n`);
          terminal(`ID: ${user.id}\n`);
          terminal(`External ID: ${user.externalId}\n`);

          if (user.integrations && user.integrations.length > 0) {
            terminal(`\nIntegrations (${user.integrations.length}):\n`);
            for (const integration of user.integrations) {
              const authStatus = integration.authStatus || "UNKNOWN";
              const statusColor =
                authStatus === "AUTHORIZED" ? terminal.green :
                authStatus === "UNAUTHORIZED" ? terminal.red :
                authStatus === "EXPIRED" ? terminal.yellow :
                terminal;

              terminal(`  - ${integration.name} (${integration.title})\n`);
              terminal(`    Auth Type: ${integration.authType}\n`);
              terminal(`    Status: `);
              statusColor(`${authStatus}\n`);

              if (integration.actions && integration.actions.length > 0) {
                terminal.gray(`    Actions: ${integration.actions.map((a: any) => a.name).join(", ")}\n`);
              }
              if (integration.webhooks && integration.webhooks.length > 0) {
                terminal.gray(`    Webhooks: ${integration.webhooks.map((w: any) => w.name).join(", ")}\n`);
              }
            }
          } else {
            terminal.gray("\nNo integrations configured\n");
          }
        }
      } catch (error) {
        terminal.red(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  );
