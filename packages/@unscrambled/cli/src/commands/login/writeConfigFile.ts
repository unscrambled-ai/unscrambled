import { program } from "commander";
import { ServerResponse } from "http";
import { terminal } from "terminal-kit";
import {
  readConfig,
  writeConfig,
  getConfigFilePath,
  UnscrambledConfig,
} from "../../shared/configManager";

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
      apiKey: UNSCRAMBLED_API_KEY,
    };

    // Only store baseUrl if it's not the default production URL
    if (baseUrl !== "https://app.unscrambled.ai") {
      config.baseUrl = baseUrl;
    } else {
      delete config.baseUrl;
    }

    writeConfig(config);

    res.setHeader("location", `${baseUrl}/cli-login/succeeded`);
    res.end();
    terminal(`Login successful, wrote credentials to ${getConfigFilePath()}\n`);
  } catch (error) {
    res.setHeader("location", `${baseUrl}/cli-login/failed`);
    res.end();
    program.error("Failed to write config file: " + error);
  }
}
