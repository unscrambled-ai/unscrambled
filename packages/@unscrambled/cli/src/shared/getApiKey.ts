import { getApiKeyFromConfig, writeConfig, readConfig } from "./configManager";
import {
  isKeychainAvailable,
  loadFromKeychain,
  saveToKeychain,
} from "./keychain";

/**
 * Get the API key from the most secure available source.
 * Priority:
 * 1. OS keychain (macOS Keychain, Linux libsecret, Windows Credential Manager)
 * 2. UNSCRAMBLED_API_KEY environment variable
 * 3. API_KEY environment variable (legacy)
 *
 * On first call, if a key exists in the legacy YAML config file and the
 * keychain is available, the key is automatically migrated to the keychain
 * and removed from the file.
 */
export function getApiKey(): string | undefined {
  if (isKeychainAvailable()) {
    const keychainKey = loadFromKeychain();
    if (keychainKey) {
      return keychainKey;
    }

    // Migrate key from legacy YAML config → keychain
    const legacyKey = getApiKeyFromConfig();
    if (legacyKey) {
      migrateKeyToKeychain(legacyKey);
      return legacyKey;
    }
  }

  return process.env.UNSCRAMBLED_API_KEY || process.env.API_KEY;
}

function migrateKeyToKeychain(apiKey: string): void {
  try {
    saveToKeychain(apiKey);

    const config = readConfig();
    delete config.apiKey;
    writeConfig(config);
  } catch {
    // Migration failed silently — key remains in YAML as fallback
  }
}
