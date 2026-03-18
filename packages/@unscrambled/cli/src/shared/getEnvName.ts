/**
 * Get the environment name from config file or environment variables.
 *
 * Priority:
 * 1. Config file (~/.unscrambled/.unscrambled.yaml)
 * 2. UNSCRAMBLED_ENV environment variable
 * 3. ENV_NAME environment variable (legacy)
 */
import { getEnvNameFromConfig } from "./configManager";

export function getEnvName(): string {
  const configEnvName = getEnvNameFromConfig();
  if (configEnvName) return configEnvName;

  const envName = process.env.UNSCRAMBLED_ENV || process.env.ENV_NAME;
  if (envName) return envName;

  throw new Error(
    "No environment specified. Pass --env <name>, set UNSCRAMBLED_ENV, or set envName in ~/.unscrambled/.unscrambled.yaml."
  );
}
