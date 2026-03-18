import { prompt } from "enquirer";
import { terminal } from "terminal-kit";
import getCompiledCode from "../../shared/getCompiledCode";
import readPackage from "../../shared/readPackage";
import runInContext from "../../shared/runInContext";
import invariant from "tiny-invariant";
import { getManagedUsers, triggerAction } from "../../shared/triggerAction";

interface TriggerPreferences {
  lastAction?: string;
  lastManagedUser?: string;
  triggerForAllManagedUsers?: boolean;
}

const PREF_KEY = "lightyear-trigger-preferences";

export async function runInteractiveTrigger(
  envOverride?: string
): Promise<void> {
  const environment = envOverride ?? "dev";

  const pkg = readPackage();
  const compiledCode = getCompiledCode(pkg.main);

  let getDeployList;
  try {
    const runInContextResult = runInContext(compiledCode);
    getDeployList = runInContextResult.getDeployList;
  } catch (error) {
    terminal.red("Failed to load compiled code: ");
    terminal(`${error}\n`);
    return;
  }

  if (!getDeployList) {
    terminal.red("No deploy list found. Please build your project first.\n");
    return;
  }

  const deployList = getDeployList();
  const actions = deployList
    .filter((item: any) => item.type === "action")
    .map((item: any) => item.actionProps?.name)
    .filter(Boolean);

  if (actions.length === 0) {
    terminal.yellow("No actions found in your project.\n");
    return;
  }

  const prefs = loadPreferences();

  const actionChoices = actions.map((action: string) => ({
    name: action,
    message:
      action === prefs.lastAction ? `${action} (last triggered)` : action,
    hint: action === prefs.lastAction ? "↵ to select" : undefined,
  }));

  const { selectedAction } = await prompt<{ selectedAction: string }>({
    type: "select",
    name: "selectedAction",
    message: "Select an action to trigger:",
    choices: actionChoices,
    initial: prefs.lastAction ? actions.indexOf(prefs.lastAction) : 0,
  });

  const managedUsers = await getManagedUsers(environment);
  let managedUserId: string | undefined;
  let triggerForAllManagedUsers = false;

  if (managedUsers.length > 0) {
    const { managedUserChoice } = await prompt<{ managedUserChoice: string }>({
      type: "select",
      name: "managedUserChoice",
      message: "Trigger for:",
      choices: [
        { name: "all", message: "All managed users" },
        { name: "specific", message: "Specific managed user" },
      ],
      initial: prefs.triggerForAllManagedUsers ? 0 : 1,
    });

    if (managedUserChoice === "all") {
      triggerForAllManagedUsers = true;
    } else {
      const userChoices = managedUsers.map((user) => ({
        name: user.id,
        message:
          user.id === prefs.lastManagedUser
            ? `${user.displayName} (${user.externalId}) (last triggered)`
            : `${user.displayName} (${user.externalId})`,
      }));

      const { selectedUser } = await prompt<{ selectedUser: string }>({
        type: "select",
        name: "selectedUser",
        message: "Select a managed user:",
        choices: userChoices,
        initial: prefs.lastManagedUser
          ? managedUsers.findIndex((u) => u.id === prefs.lastManagedUser)
          : 0,
      });

      managedUserId = selectedUser;
    }
  }

  savePreferences({
    lastAction: selectedAction,
    lastManagedUser: managedUserId,
    triggerForAllManagedUsers,
  });

  terminal.cyan(
    `\nTriggering action: ${selectedAction} (env: ${environment})\n`
  );

  if (triggerForAllManagedUsers && managedUsers.length > 0) {
    terminal(
      `Triggering for all ${managedUsers.length} managed users in ${environment}...\n`
    );

    const { success, error } = await triggerAction(selectedAction, {
      managedUserId: "ALL",
      environment,
    });

    if (success) {
      terminal.green(
        `\n✓ Action triggered successfully for all managed users in ${environment}\n`
      );
    } else {
      terminal.red(
        `\n✗ Failed to trigger action for all managed users in ${environment}: ${error}\n`
      );
    }
  } else {
    if (managedUserId) {
      const user = managedUsers.find((u) => u.id === managedUserId);
      invariant(user, "Managed user not found");
      terminal(
        `Triggering for ${user.displayName} (${user.externalId}) in ${environment}...\n`
      );
    }

    const { success, error } = await triggerAction(selectedAction, {
      managedUserId,
      environment,
    });

    if (success) {
      terminal.green(`\n✓ Action triggered successfully in ${environment}\n`);
    } else {
      terminal.red(`\n✗ Failed to trigger action: ${error}\n`);
    }
  }
}

function loadPreferences(): TriggerPreferences {
  try {
    const contents = localStorage.getItem(PREF_KEY);
    return contents ? JSON.parse(contents) : {};
  } catch (error) {
    console.debug("Failed to load preferences:", error);
    return {};
  }
}

function savePreferences(prefs: TriggerPreferences) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.debug("Failed to save preferences:", error);
  }
}
