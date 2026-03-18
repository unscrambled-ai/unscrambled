import { getBaseUrlFromConfig } from "./configManager";

/**
 * Get the base URL from config file or environment variables
 * Priority:
 * 1. Config file (~/.lightyear/.lightyear.yaml)
 * 2. BASE_URL environment variable
 * 3. Default production URL
 */
export function getBaseUrl(): string {
  // First try to get from config file
  const configBaseUrl = getBaseUrlFromConfig();
  if (configBaseUrl) {
    return configBaseUrl;
  }

  // Fall back to environment variables for backward compatibility
  return process.env.BASE_URL || "https://app.runlightyear.com";
}
