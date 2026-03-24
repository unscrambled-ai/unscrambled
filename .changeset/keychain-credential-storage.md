---
"@unscrambled/cli": minor
---

Store API keys in the OS keychain instead of plaintext config files

- Added OS keychain integration (macOS Keychain, Linux libsecret, Windows Credential Manager) for secure credential storage
- API keys from `un login` are now stored in encrypted OS storage by default
- Existing keys in `~/.unscrambled/.unscrambled.yaml` are automatically migrated to the keychain on first use
- Falls back to `UNSCRAMBLED_API_KEY` environment variable when no keychain is available (CI, Docker, headless)
- Added `un logout` command to remove stored credentials
- Secrets are written via stdin to avoid exposure in process listings
- All keychain operations have a 3-second timeout to prevent hangs
