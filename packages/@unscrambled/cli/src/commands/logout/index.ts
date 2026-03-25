import { Command, Option } from "commander";
import { terminal } from "terminal-kit";
import { readConfig, writeConfig } from "../../shared/configManager";
import { deleteFromKeychain, isKeychainAvailable } from "../../shared/keychain";
import { writeJson } from "../../shared/commandUtils";

export const logout = new Command("logout")
  .description("Log out and remove stored credentials")
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(async (options: { output: "text" | "json" }) => {
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

    if (options.output === "json") {
      writeJson({ cleared });
      return;
    }

    if (cleared) {
      terminal.green("Logged out successfully. Credentials removed.\n");
    } else {
      terminal("No stored credentials found.\n");
    }
  });
