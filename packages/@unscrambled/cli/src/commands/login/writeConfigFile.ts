import { program } from "commander";
import { ServerResponse } from "http";
import { terminal } from "terminal-kit";
import {
  readConfig,
  writeConfig,
  UnscrambledConfig,
} from "../../shared/configManager";
import { isKeychainAvailable, saveToKeychain } from "../../shared/keychain";

export default async function writeConfigFile(
  {
    UNSCRAMBLED_API_KEY,
    baseUrl,
  }: { UNSCRAMBLED_API_KEY: string; baseUrl: string },
  res: ServerResponse
) {
  try {
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
      terminal("Login successful, API key stored in system keychain\n");
    } else {
      config.apiKey = UNSCRAMBLED_API_KEY;
      writeConfig(config);

      res.setHeader("location", `${baseUrl}/cli-login/succeeded`);
      res.end();
      terminal.yellow(
        "Warning: OS keychain not available. API key stored in config file.\n"
      );
      terminal(
        "For better security, install OS keychain support and run `unscrambled login` again.\n"
      );
    }
  } catch (error) {
    res.setHeader("location", `${baseUrl}/cli-login/failed`);
    res.end();
    program.error("Failed to write config file: " + error);
  }
}
