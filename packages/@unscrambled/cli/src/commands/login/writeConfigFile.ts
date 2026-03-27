import { program } from "commander";
import { ServerResponse } from "http";
import { terminal } from "terminal-kit";
import {
  readConfig,
  writeConfig,
  UnscrambledConfig,
} from "../../shared/configManager";
import { isKeychainAvailable, saveToKeychain } from "../../shared/keychain";

function isJsonOutput(): boolean {
  return process.env.UNSCRAMBLED_CLI_OUTPUT_FORMAT === "json";
}

export default async function writeConfigFile(
  {
    UNSCRAMBLED_API_KEY,
    baseUrl,
  }: { UNSCRAMBLED_API_KEY: string; baseUrl: string },
  res: ServerResponse
): Promise<"keychain" | "config"> {
  try {
    if (!UNSCRAMBLED_API_KEY?.trim()) {
      throw new Error("Login response did not include an API key");
    }

    const existing = readConfig();

    const config: UnscrambledConfig = {
      ...existing,
    };
    delete config.apiKey;

    if (baseUrl !== "https://app.unscrambled.ai") {
      config.baseUrl = baseUrl;
    } else {
      delete config.baseUrl;
    }

    if (isKeychainAvailable()) {
      saveToKeychain(UNSCRAMBLED_API_KEY);
      writeConfig(config);

      res.setHeader("location", `${baseUrl}/cli-login/succeeded`);
      res.end();
      if (!isJsonOutput()) {
        terminal("Login successful, API key stored in system keychain\n");
      }
      return "keychain";
    } else {
      config.apiKey = UNSCRAMBLED_API_KEY;
      writeConfig(config);

      res.setHeader("location", `${baseUrl}/cli-login/succeeded`);
      res.end();
      if (!isJsonOutput()) {
        terminal.yellow(
          "Warning: OS keychain not available. API key stored in config file.\n"
        );
        terminal(
          "For better security, install OS keychain support and run `unscrambled login` again.\n"
        );
      }
      return "config";
    }
  } catch (error) {
    res.setHeader("location", `${baseUrl}/cli-login/failed`);
    res.end();
    program.error("Failed to write config file: " + error);
  }
}
