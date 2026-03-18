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
import { getEnvName } from "../../shared/getEnvName";

const DEFAULT_ACTION = "self";

export const trigger = new Command("trigger");
trigger
  .description("Trigger an action")
  .argument("[action]", "Action name", DEFAULT_ACTION)
  .option("--managed-user-id <id>", "Managed user ID")
  .option("--managed-user-external-id <externalId>", "Managed user external ID")
  .option("--all-managed-users", "Trigger for all managed users")
  .option("--interactive", "Prompt for action and managed user")
  .option("--env <envName>", "Environment name (e.g. dev, prod)")
  .action(async (actionName, options) => {
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
      environment = env ?? getEnvName();
    } catch (error) {
      terminal.red(
        `${error instanceof Error ? error.message : String(error)}\n`
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
      terminal.red(
        "Specify only one of --managed-user-id, --managed-user-external-id, or --all-managed-users.\n"
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
        terminal.red(
          `Managed user with external id '${managedUserExternalId}' not found.\n`
        );
        process.exitCode = 1;
        return;
      }

      payload.managedUserId = user.id;
      payload.managedUserExternalId = user.externalId;
      terminal.gray(
        `Resolved managed user external id '${managedUserExternalId}' to managed user id '${user.id}'.\n`
      );
      scopeParts.push(`managed user '${user.id}' (${user.externalId})`);
    }

    if (!payload.managedUserId) {
      terminal.red(
        "No managed user specified. Use --managed-user-id, --managed-user-external-id, --all-managed-users, or --interactive.\n"
      );
      process.exitCode = 1;
      return;
    }

    const scopeDescription =
      scopeParts.length > 0 ? ` for ${scopeParts.join(" and ")}` : "";

    terminal.cyan(
      `\nTriggering action '${resolvedAction}'${scopeDescription}...\n`
    );

    const response = await triggerAction(resolvedAction, payload);

    if (!response.success) {
      terminal.red(
        `\n✗ Failed to trigger action '${resolvedAction}'${scopeDescription}: ${response.error}\n`
      );
      process.exitCode = 1;
      return;
    }

    terminal.green(
      `\n✓ Action '${resolvedAction}' triggered successfully${scopeDescription}\n`
    );
  });
