import fs from "fs";
import path from "path";
import os from "os";
import yaml from "js-yaml";

export interface UnscrambledConfig {
  apiKey?: string;
  baseUrl?: string;
  envName?: string;
}

/**
 * Get the config directory path based on the operating system
 * - macOS/Linux: ~/.unscrambled
 * - Windows: %USERPROFILE%/.unscrambled
 */
export function getConfigDir(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, ".unscrambled");
}

/**
 * Get the full path to the config file
 */
export function getConfigFilePath(): string {
  return path.join(getConfigDir(), ".unscrambled.yaml");
}

/**
 * Ensure the config directory exists
 */
export function ensureConfigDir(): void {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

/**
 * Read the config file
 * Returns an empty object if the file doesn't exist
 */
export function readConfig(): UnscrambledConfig {
  const configPath = getConfigFilePath();

  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const fileContents = fs.readFileSync(configPath, "utf8");
    const config = yaml.load(fileContents) as UnscrambledConfig;
    return config || {};
  } catch (error) {
    console.error(`Failed to read config file: ${error}`);
    return {};
  }
}

/**
 * Write the config file
 */
export function writeConfig(config: UnscrambledConfig): void {
  ensureConfigDir();
  const configPath = getConfigFilePath();

  try {
    const yamlContent = yaml.dump(config);
    fs.writeFileSync(configPath, yamlContent, "utf8");
  } catch (error) {
    throw new Error(`Failed to write config file: ${error}`);
  }
}

/**
 * Get the API key from the config file
 * Returns undefined if not found
 */
export function getApiKeyFromConfig(): string | undefined {
  const config = readConfig();
  return config.apiKey;
}

/**
 * Get the base URL from the config file
 * Returns undefined if not found
 */
export function getBaseUrlFromConfig(): string | undefined {
  const config = readConfig();
  return config.baseUrl;
}

/**
 * Get the default environment name from the config file
 * Returns undefined if not found
 */
export function getEnvNameFromConfig(): string | undefined {
  const config = readConfig();
  return config.envName;
}

/**
 * Check if the user is authenticated (has an API key)
 */
export function isAuthenticated(): boolean {
  return !!getApiKeyFromConfig();
}
