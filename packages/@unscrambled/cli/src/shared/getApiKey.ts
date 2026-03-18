import { getApiKeyFromConfig } from "./configManager";

/**
 * Get the API key from config file or environment variables
 * Priority:
 * 1. Config file (~/.lightyear/.lightyear.yaml)
 * 2. LIGHTYEAR_API_KEY environment variable
 * 3. API_KEY environment variable (legacy)
 */
export function getApiKey(): string | undefined {
  // First try to get from config file
  const configApiKey = getApiKeyFromConfig();
  if (configApiKey) {
    return configApiKey;
  }

  // Fall back to environment variables for backward compatibility
  return process.env.LIGHTYEAR_API_KEY || process.env.API_KEY;
}
