import { Command, Option, program } from "commander";
import { terminal } from "terminal-kit";

import { requireAuth } from "../../shared/requireAuth";
import { getApiKey } from "../../shared/getApiKey";
import { getBaseUrl } from "../../shared/getBaseUrl";
import { getEnvName } from "../../shared/getEnvName";
import {
  checkResponseOk,
  parseJsonResponse,
} from "../../shared/parseJsonResponse";

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

export const integrations = new Command("integrations").description(
  "Manage and inspect integrations"
);

// List integrations
integrations
  .command("list")
  .description("List all integrations")
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

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/integrations`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          checkResponseOk(response, "List integrations");
          throw new Error(
            `List integrations failed: HTTP ${response.status} ${response.statusText}`
          );
        }

        const result = await parseJsonResponse(response, {
          operationName: "list integrations",
        });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          const integrations = result.integrations ?? result ?? [];
          if (!Array.isArray(integrations) || integrations.length === 0) {
            terminal("No integrations found\n");
            return;
          }

          terminal.bold(`Integrations:\n\n`);
          for (const int of integrations) {
            const statusColor = int.disabled ? terminal.gray : terminal.green;
            const status = int.disabled ? "disabled" : "enabled";

            terminal.bold(`${int.name}`);
            terminal(` (${int.title}) `);
            statusColor(`[${status}]`);
            terminal("\n");

            const app = int.customApp?.name || int.app?.name || "(no app)";
            terminal.gray(`  app: ${app}\n`);

            if (int.actions && int.actions.length > 0) {
              terminal.gray(
                `  actions: ${int.actions.map((a: any) => a.name).join(", ")}\n`
              );
            }
            if (int.syncs && int.syncs.length > 0) {
              terminal.gray(`  syncs: ${int.syncs.length}\n`);
            }
            terminal("\n");
          }

          terminal(`Total: ${integrations.length} integration(s)\n`);
        }
      } catch (error) {
        terminal.red(
          `${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exitCode = 1;
      }
    }
  );

// Get integration status/details
integrations
  .command("get")
  .description("Get details for a specific integration")
  .argument("<name>", "Integration name")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (
      name: string,
      options: { env?: string; environment?: string; output: OutputFormat }
    ) => {
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

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/integrations/${name}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            terminal.red(`Integration '${name}' not found\n`);
            process.exitCode = 1;
            return;
          }
          checkResponseOk(response, "Get integration");
          throw new Error(
            `Get integration failed: HTTP ${response.status} ${response.statusText}`
          );
        }

        const int = await parseJsonResponse(response, {
          operationName: "get integration",
        });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(int, null, 2)}\n`);
        } else {
          terminal.bold(`Integration: ${int.name}\n\n`);
          terminal(`Title: ${int.title}\n`);
          terminal(`Status: ${int.disabled ? "disabled" : "enabled"}\n`);

          if (int.app) {
            terminal(`App: ${int.app.name} (${int.app.title})\n`);
          }
          if (int.customApp) {
            terminal(
              `Custom App: ${int.customApp.name} (${int.customApp.title})\n`
            );
            terminal(`Auth Type: ${int.customApp.authType}\n`);
          }

          if (int.actions && int.actions.length > 0) {
            terminal(`\nActions (${int.actions.length}):\n`);
            for (const action of int.actions) {
              terminal(`  - ${action.name} (${action.title})\n`);
            }
          }

          if (int.webhooks && int.webhooks.length > 0) {
            terminal(`\nWebhooks (${int.webhooks.length}):\n`);
            for (const webhook of int.webhooks) {
              terminal(`  - ${webhook.name} (${webhook.title})\n`);
            }
          }

          if (int.syncs && int.syncs.length > 0) {
            terminal(`\nSyncs (${int.syncs.length}):\n`);
            for (const sync of int.syncs) {
              terminal(
                `  - ${sync.collection?.name || "?"} [${sync.status}]\n`
              );
            }
          }
        }
      } catch (error) {
        terminal.red(
          `${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exitCode = 1;
      }
    }
  );
