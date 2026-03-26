import { Command, Option, program } from "commander";
import { terminal } from "terminal-kit";

import {
  OutputFormat,
  getEnvOption,
  resolveEnvName,
  writeError,
  writeInfo,
  writeJson,
  writeSuccess,
  writeWarning,
} from "../../shared/commandUtils";
import { requireAuth } from "../../shared/requireAuth";
import { getApiKey } from "../../shared/getApiKey";
import { getBaseUrl } from "../../shared/getBaseUrl";
import {
  checkResponseOk,
  parseJsonResponse,
} from "../../shared/parseJsonResponse";
import { triggerAction } from "../../shared/triggerAction";

export const actions = new Command("actions")
  .description("Manage and trigger actions")
  .addHelpText(
    "after",
    `
Examples:
  unscrambled actions list --env dev
  unscrambled actions trigger send-email --env prod --managed-user-external-id user_123
  unscrambled actions trigger self --env dev --all-managed-users --output json
`
  );

// List actions
actions
  .command("list")
  .description("List all actions")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(
    new Option("-i, --integration <name>", "Filter by integration name")
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
      integration?: string;
      output: OutputFormat;
    }) => {
      requireAuth();

      let envName: string;
      try {
        envName = resolveEnvName(getEnvOption(options));
      } catch (error) {
        writeError(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
        return;
      }

      try {
        const baseUrl = getBaseUrl();
        const apiKey = getApiKey();

        const params = new URLSearchParams();
        if (options.integration)
          params.set("integrationName", options.integration);

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
          throw new Error(
            `List actions failed: HTTP ${response.status} ${response.statusText}`
          );
        }

        const result = await parseJsonResponse(response, {
          operationName: "list actions",
        });

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
            terminal.gray(
              `  integration: ${act.integration?.name || "(none)"}\n`
            );
            if (act.trigger) {
              terminal.gray(`  trigger: ${act.trigger}\n`);
            }
            terminal("\n");
          }

          terminal(`Total: ${actions.length} action(s)\n`);
        }
      } catch (error) {
        writeError(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    }
  );

// Trigger an action
actions
  .command("trigger")
  .description("Manually trigger an action")
  .argument("<name>", "Action name")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(new Option("--managed-user-id <id>", "Managed user ID"))
  .addOption(
    new Option(
      "-m, --managed-user-external-id <id>",
      "Managed user external ID"
    )
  )
  .addOption(new Option("--all-managed-users", "Trigger for all managed users"))
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
        managedUserId?: string;
        managedUserExternalId?: string;
        allManagedUsers?: boolean;
        data?: string;
        output: OutputFormat;
      }
    ) => {
      requireAuth();

      let envName: string;
      try {
        envName = resolveEnvName(getEnvOption(options));
      } catch (error) {
        writeError(
          error instanceof Error ? error.message : String(error),
          options
        );
        process.exitCode = 1;
        return;
      }

      try {
        let data: any = undefined;
        if (options.data) {
          try {
            data = JSON.parse(options.data);
          } catch {
            writeError("Invalid JSON data provided", options);
            process.exitCode = 1;
            return;
          }
        }

        const selectionCount = [
          options.managedUserId,
          options.managedUserExternalId,
          options.allManagedUsers ? "ALL" : undefined,
        ].filter(Boolean).length;

        if (selectionCount > 1) {
          writeError(
            "Specify only one of --managed-user-id, --managed-user-external-id, or --all-managed-users.",
            options
          );
          process.exitCode = 1;
          return;
        }

        const scopeParts: string[] = [`env '${envName}'`];
        if (options.managedUserId) {
          scopeParts.push(`managed user '${options.managedUserId}'`);
        } else if (options.managedUserExternalId) {
          scopeParts.push(
            `managed user external id '${options.managedUserExternalId}'`
          );
        } else if (options.allManagedUsers) {
          scopeParts.push("all managed users");
        }

        writeInfo(
          `Triggering action '${name}' for ${scopeParts.join(" and ")}...`,
          options
        );

        const result = await triggerAction(name, {
          environment: envName,
          managedUserId: options.allManagedUsers
            ? "ALL"
            : options.managedUserId,
          managedUserExternalId: options.managedUserExternalId,
          data,
        });

        if (!result.success) {
          writeError(`Trigger failed: ${result.error}`, options);
          process.exitCode = 1;
          return;
        }

        if (options.output === "json") {
          writeJson(result.result);
        } else {
          writeSuccess("Action triggered successfully!", options);
          terminal(`Run ID: ${result.runId || "(unknown)"}\n`);
          if (result.status) {
            terminal(`Status: ${result.status}\n`);
          }
        }
      } catch (error) {
        writeError(
          error instanceof Error ? error.message : String(error),
          options
        );
        process.exitCode = 1;
      }
    }
  );
