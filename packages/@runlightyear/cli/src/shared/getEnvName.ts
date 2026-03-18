/**
 * Get the environment name from config file or environment variables.
 *
 * Priority:
 * 1. Config file (~/.lightyear/.lightyear.yaml)
 * 2. LIGHTYEAR_ENV environment variable
 * 3. ENV_NAME environment variable (legacy)
 */
import { getEnvNameFromConfig } from "./configManager";

export function getEnvName(): string {
  const configEnvName = getEnvNameFromConfig();
  if (configEnvName) return configEnvName;

  const envName = process.env.LIGHTYEAR_ENV || process.env.ENV_NAME;
  if (envName) return envName;

  throw new Error(
    "No environment specified. Pass --env <name>, set LIGHTYEAR_ENV, or set envName in ~/.lightyear/.lightyear.yaml."
  );
}
