import { program } from "commander";
import { terminal } from "terminal-kit";
import { getApiKey } from "./getApiKey";

/**
 * Check if the user is authenticated and provide a helpful error message if not
 * This should be called at the beginning of commands that require authentication
 */
export function requireAuth(): void {
  const apiKey = getApiKey();

  if (!apiKey) {
    terminal.red("\n❌ Authentication required\n\n");
    terminal("You need to log in or sign up before using this command.\n\n");
    terminal.bold("To get started, run one of the following commands:\n");
    terminal.green("  lightyear login\n");
    terminal.green("  lightyear signup\n\n");

    program.error("", { exitCode: 1 });
  }
}
