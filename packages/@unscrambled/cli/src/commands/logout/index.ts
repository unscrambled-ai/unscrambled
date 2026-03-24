import { Command } from "commander";
import { terminal } from "terminal-kit";
import { readConfig, writeConfig } from "../../shared/configManager";
import { deleteFromKeychain, isKeychainAvailable } from "../../shared/keychain";

export const logout = new Command("logout")
  .description("Log out and remove stored credentials")
  .action(async () => {
    let cleared = false;

    if (isKeychainAvailable()) {
      cleared = deleteFromKeychain();
    }

    const config = readConfig();
    if (config.apiKey) {
      delete config.apiKey;
      writeConfig(config);
      cleared = true;
    }

    if (cleared) {
      terminal.green("Logged out successfully. Credentials removed.\n");
    } else {
      terminal("No stored credentials found.\n");
    }
  });
