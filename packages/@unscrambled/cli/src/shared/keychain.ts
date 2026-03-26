import { execSync } from "child_process";
import os from "os";

const SERVICE = "unscrambled-cli";
const ACCOUNT = "api-key";
const TIMEOUT_MS = 3_000;

const ENCODING_PREFIX = "unscrambled-b64:";

/**
 * Check whether the OS keychain is usable on this machine.
 * Returns false in CI, Docker, headless Linux without libsecret, etc.
 */
export function isKeychainAvailable(): boolean {
  try {
    switch (os.platform()) {
      case "darwin":
        execSync("which security", { stdio: "pipe", timeout: TIMEOUT_MS });
        return true;
      case "linux":
        execSync("which secret-tool", { stdio: "pipe", timeout: TIMEOUT_MS });
        return true;
      case "win32":
        execSync("where cmdkey", { stdio: "pipe", timeout: TIMEOUT_MS });
        return true;
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Store the API key in the OS keychain.
 *
 * On macOS, writes via stdin to `security -i` (interactive mode) so the
 * secret never appears as a command-line argument visible in `ps` output.
 * Values are base64-encoded to avoid macOS hex-encoding issues with
 * non-ASCII or multiline strings.
 */
export function saveToKeychain(apiKey: string): void {
  const encoded = ENCODING_PREFIX + Buffer.from(apiKey).toString("base64");

  switch (os.platform()) {
    case "darwin": {
      // -U flag = update if entry already exists (no need to delete first)
      const command = `add-generic-password -U -s ${shellQuote(
        SERVICE
      )} -a ${shellQuote(ACCOUNT)} -w ${shellQuote(encoded)}\n`;
      execSync("security -i", {
        input: command,
        stdio: ["pipe", "pipe", "pipe"],
        timeout: TIMEOUT_MS,
      });
      break;
    }
    case "linux": {
      execSync(
        `secret-tool store --label=${shellQuote(SERVICE)} service ${shellQuote(
          SERVICE
        )} account ${shellQuote(ACCOUNT)}`,
        {
          input: encoded,
          stdio: ["pipe", "pipe", "pipe"],
          timeout: TIMEOUT_MS,
        }
      );
      break;
    }
    case "win32": {
      execSync(`cmdkey /generic:${SERVICE} /user:${ACCOUNT} /pass:${encoded}`, {
        stdio: "pipe",
        timeout: TIMEOUT_MS,
      });
      break;
    }
  }
}

/**
 * Load the API key from the OS keychain.
 * Returns undefined if no entry exists or the keychain is unreachable.
 */
export function loadFromKeychain(): string | undefined {
  try {
    let raw: string | undefined;

    switch (os.platform()) {
      case "darwin":
        raw = execSync(
          `security find-generic-password -s ${shellQuote(
            SERVICE
          )} -a ${shellQuote(ACCOUNT)} -w`,
          { stdio: "pipe", encoding: "utf8", timeout: TIMEOUT_MS }
        ).trim();
        break;
      case "linux":
        raw = execSync(
          `secret-tool lookup service ${shellQuote(
            SERVICE
          )} account ${shellQuote(ACCOUNT)}`,
          { stdio: "pipe", encoding: "utf8", timeout: TIMEOUT_MS }
        ).trim();
        break;
      case "win32": {
        raw = execSync(
          `powershell -Command "(New-Object Net.NetworkCredential((cmdkey /list:${SERVICE} | Select-String 'User').ToString().Split(':')[1].Trim(), (Get-StoredCredential -Target ${SERVICE}).Password)).Password"`,
          { stdio: "pipe", encoding: "utf8", timeout: TIMEOUT_MS }
        ).trim();
        break;
      }
      default:
        return undefined;
    }

    if (!raw) return undefined;

    if (raw.startsWith(ENCODING_PREFIX)) {
      return Buffer.from(raw.slice(ENCODING_PREFIX.length), "base64").toString(
        "utf8"
      );
    }

    // Plain value — written before encoding was introduced, or on a
    // platform that doesn't round-trip encoded values.
    return raw;
  } catch {
    return undefined;
  }
}

export function deleteFromKeychain(): boolean {
  try {
    switch (os.platform()) {
      case "darwin":
        execSync(
          `security delete-generic-password -s ${shellQuote(
            SERVICE
          )} -a ${shellQuote(ACCOUNT)}`,
          { stdio: "pipe", timeout: TIMEOUT_MS }
        );
        return true;
      case "linux":
        execSync(
          `secret-tool clear service ${shellQuote(
            SERVICE
          )} account ${shellQuote(ACCOUNT)}`,
          { stdio: "pipe", timeout: TIMEOUT_MS }
        );
        return true;
      case "win32":
        execSync(`cmdkey /delete:${SERVICE}`, {
          stdio: "pipe",
          timeout: TIMEOUT_MS,
        });
        return true;
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * POSIX-safe shell quoting: wraps in single quotes with internal
 * single quotes escaped as '\'' (end quote, escaped literal, reopen quote).
 */
function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}
