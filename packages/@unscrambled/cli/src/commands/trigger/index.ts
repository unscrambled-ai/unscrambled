import { Command, program } from "commander";
import { terminal } from "terminal-kit";
import { setLogDisplayLevel } from "../../shared/setLogDisplayLevel";
import { prepareConsole } from "../../logging";
import {
  triggerAction,
  getManagedUsers,
  TriggerPayload,
} from "../../shared/triggerAction";
import { runInteractiveTrigger } from "./interactive";
import { requireAuth } from "../../shared/requireAuth";
import {
  OutputFormat,
  resolveEnvName,
  writeError,
  writeInfo,
  writeJson,
  writeSuccess,
} from "../../shared/commandUtils";

const DEFAULT_ACTION = "self";

export const trigger = new Command("trigger");
trigger
  .description("Trigger an action, primarily for the local dev workflow")
  .argument("[action]", "Action name", DEFAULT_ACTION)
  .option("--managed-user-id <id>", "Managed user ID")
  .option("--managed-user-external-id <externalId>", "Managed user external ID")
  .option("--all-managed-users", "Trigger for all managed users")
  .option("--interactive", "Prompt for action and managed user")
  .option("--env <envName>", "Environment name (e.g. dev, prod)")
  .option("-o, --output <format>", "Output format", "text")
  .addHelpText(
    "after",
    `
Examples:
  unscrambled trigger --interactive --env dev
  unscrambled trigger self --env dev --managed-user-id mu_123
  unscrambled trigger send-email --env prod --all-managed-users --output json
`
  )
  .action(
    async (
      actionName,
      options: {
        managedUserId?: string;
        managedUserExternalId?: string;
        allManagedUsers?: boolean;
        interactive?: boolean;
        env?: string;
        output?: OutputFormat;
      }
    ) => {
      requireAuth();

      const globalOptions = program.opts();
      if (globalOptions.debug) {
        setLogDisplayLevel("DEBUG");
        prepareConsole();
        console.debug("Outputting debug information");
      }

      const resolvedAction = actionName || DEFAULT_ACTION;
      const {
        managedUserId,
        managedUserExternalId,
        allManagedUsers,
        interactive,
        env,
      } = options;

      let environment: string;
      try {
        environment = resolveEnvName(env);
      } catch (error) {
        writeError(
          error instanceof Error ? error.message : String(error),
          options
        );
        process.exitCode = 1;
        return;
      }

      if (interactive) {
        await runInteractiveTrigger(environment);
        return;
      }

      const selectionCount = [
        managedUserId,
        managedUserExternalId,
        allManagedUsers ? "ALL" : undefined,
      ].filter(Boolean).length;

      if (selectionCount > 1) {
        writeError(
          "Specify only one of --managed-user-id, --managed-user-external-id, or --all-managed-users.",
          options
        );
        process.exitCode = 1;
        return;
      }

      const payload: TriggerPayload = { environment };
      const scopeParts: string[] = [`env '${environment}'`];

      if (allManagedUsers) {
        payload.managedUserId = "ALL";
        scopeParts.push("all managed users");
      } else if (managedUserId) {
        payload.managedUserId = managedUserId;
        scopeParts.push(`managed user '${managedUserId}'`);
      } else if (managedUserExternalId) {
        const managedUsers = await getManagedUsers(environment);
        const user = managedUsers.find(
          (u) => u.externalId === String(managedUserExternalId)
        );

        if (!user) {
          writeError(
            `Managed user with external id '${managedUserExternalId}' not found.`,
            options
          );
          process.exitCode = 1;
          return;
        }

        payload.managedUserId = user.id;
        payload.managedUserExternalId = user.externalId;
        writeInfo(
          `Resolved managed user external id '${managedUserExternalId}' to managed user id '${user.id}'.`,
          options
        );
        scopeParts.push(`managed user '${user.id}' (${user.externalId})`);
      }

      if (!payload.managedUserId) {
        writeError(
          "No managed user specified. Use --managed-user-id, --managed-user-external-id, --all-managed-users, or --interactive.",
          options
        );
        process.exitCode = 1;
        return;
      }

      const scopeDescription =
        scopeParts.length > 0 ? ` for ${scopeParts.join(" and ")}` : "";

      writeInfo(
        `Triggering action '${resolvedAction}'${scopeDescription}...`,
        options
      );

      const response = await triggerAction(resolvedAction, payload);

      if (!response.success) {
        writeError(
          `Failed to trigger action '${resolvedAction}'${scopeDescription}: ${response.error}`,
          options
        );
        process.exitCode = 1;
        return;
      }

      if (options.output === "json") {
        writeJson(response.result);
        return;
      }

      writeSuccess(
        `Action '${resolvedAction}' triggered successfully${scopeDescription}`,
        options
      );
      if (response.runId) {
        terminal(`Run ID: ${response.runId}\n`);
      }
      if (response.status) {
        terminal(`Status: ${response.status}\n`);
      }
    }
  );
