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

export const actions = new Command("actions").description(
  "Manage and trigger actions"
);

// List actions
actions
  .command("list")
  .description("List all actions")
  .addOption(new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)"))
  .addOption(new Option("-i, --integration <name>", "Filter by integration name"))
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (options: {
      env?: string;
      environment?: string;
      integration?: string;
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
        if (options.integration) params.set("integrationName", options.integration);

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/actions?${params}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          checkResponseOk(response, "List actions");
          throw new Error(`List actions failed: HTTP ${response.status} ${response.statusText}`);
        }

        const result = await parseJsonResponse(response, { operationName: "list actions" });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          const actions = result.actions ?? result ?? [];
          if (!Array.isArray(actions) || actions.length === 0) {
            terminal("No actions found\n");
            return;
          }

          terminal.bold(`Actions:\n\n`);
          for (const act of actions) {
            terminal.bold(`${act.name}`);
            terminal(` (${act.title})\n`);
            terminal.gray(`  integration: ${act.integration?.name || "(none)"}\n`);
            if (act.trigger) {
              terminal.gray(`  trigger: ${act.trigger}\n`);
            }
            terminal("\n");
          }

          terminal(`Total: ${actions.length} action(s)\n`);
        }
      } catch (error) {
        terminal.red(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  );

// Trigger an action
actions
  .command("trigger")
  .description("Manually trigger an action")
  .argument("<name>", "Action name")
  .addOption(new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)"))
  .addOption(new Option("-m, --managed-user-external-id <id>", "Managed user external ID"))
  .addOption(new Option("-d, --data <json>", "JSON data to pass to the action"))
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (
      name: string,
      options: {
        env?: string;
        environment?: string;
        managedUserExternalId?: string;
        data?: string;
        output: OutputFormat;
      }
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

        // Parse data if provided
        let data: any = undefined;
        if (options.data) {
          try {
            data = JSON.parse(options.data);
          } catch {
            terminal.red("Invalid JSON data provided\n");
            process.exitCode = 1;
            return;
          }
        }

        const body: any = { actionName: name };
        if (options.managedUserExternalId) {
          body.managedUserExternalId = options.managedUserExternalId;
        }
        if (data) {
          body.data = data;
        }

        terminal(`Triggering action: ${name}...\n`);

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/runs`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          terminal.red(`Trigger failed: ${errorData.message || response.statusText}\n`);
          process.exitCode = 1;
          return;
        }

        const result = await parseJsonResponse(response, { operationName: "trigger action" });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          terminal.green(`Action triggered successfully!\n`);
          terminal(`Run ID: ${result.id || result.runId || "(unknown)"}\n`);
          if (result.status) {
            terminal(`Status: ${result.status}\n`);
          }
        }
      } catch (error) {
        terminal.red(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  );
