import { program } from "commander";
import { terminal } from "terminal-kit";
import { getApiKey } from "./getApiKey";
import { isKeychainAvailable } from "./keychain";

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
    terminal.green("  unscrambled login\n");
    terminal.green("  unscrambled signup\n\n");

    if (!isKeychainAvailable()) {
      terminal.dim(
        "Alternatively, set the UNSCRAMBLED_API_KEY environment variable.\n\n"
      );
    }

    program.error("", { exitCode: 1 });
  }
}
