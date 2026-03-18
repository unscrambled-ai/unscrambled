# API Key Storage Migration Summary

## Overview
The CLI's API key storage has been moved from `.env` files in the project directory to a user-specific configuration directory at `~/.lightyear/.lightyear.yaml`.

Additionally, all dependencies on the deprecated `@unscrambled/lightyear` package have been removed from the CLI package. The CLI now contains its own implementations of the necessary utilities.

## Changes Made

### 1. New Configuration Management Module
**File**: `packages/@unscrambled/cli/src/shared/configManager.ts`
- Created utilities for reading/writing YAML configuration files
- Handles platform-specific paths:
  - macOS/Linux: `~/.lightyear/.lightyear.yaml`
  - Windows: `%USERPROFILE%/.lightyear/.lightyear.yaml`
- Stores `apiKey` and optionally `baseUrl` (for dev environments)

### 2. Updated Login/Signup Flow
**File**: `packages/@unscrambled/cli/src/commands/login/writeConfigFile.ts` (renamed from `writeEnvFile.ts`)
- Now writes credentials to `~/.lightyear/.lightyear.yaml` instead of `.env`
- Only stores `baseUrl` when it differs from the default production URL

**File**: `packages/@unscrambled/cli/src/commands/login/getRequestHandler.ts`
- Updated to use the renamed `writeConfigFile` function

### 3. Created Local Utility Functions in CLI
**New Files**:
- `packages/@unscrambled/cli/src/shared/getApiKey.ts`
- `packages/@unscrambled/cli/src/shared/getBaseUrl.ts`
- `packages/@unscrambled/cli/src/shared/getEnvName.ts`

These functions replace imports from the deprecated lightyear package:
1. First try to read from the config file (`~/.lightyear/.lightyear.yaml`)
2. Fall back to environment variables for backward compatibility

**Updated lightyear package** (for backward compatibility with other packages):
- `packages/@unscrambled/lightyear/src/util/getApiKey.ts`
- `packages/@unscrambled/lightyear/src/util/getBaseUrl.ts`

Both functions updated to:
1. First try to read from the config file (`~/.lightyear/.lightyear.yaml`)
2. Fall back to environment variables for backward compatibility
3. Use simple regex parsing to avoid requiring js-yaml in the lightyear package

### 4. New Authentication Check Utility
**File**: `packages/@unscrambled/cli/src/shared/requireAuth.ts`
- Provides a centralized authentication check with user-friendly error messages
- Guides users to run `lightyear login` or `lightyear signup` if not authenticated

### 5. Updated Commands to Check Authentication
Added `requireAuth()` calls to commands that require authentication:
- `packages/@unscrambled/cli/src/commands/dev/index.ts`
- `packages/@unscrambled/cli/src/commands/deploy/index.ts`
- `packages/@unscrambled/cli/src/commands/trigger/index.ts`

### 6. Updated Error Messages
**File**: `packages/@unscrambled/cli/src/shared/getPusherCredentials.ts`
- Updated to show user-friendly authentication error message

### 7. Removed Lightyear Package Dependency
**Updated**: `packages/@unscrambled/cli/package.json`
- **Removed**: `@unscrambled/lightyear` dependency
- **Added**: `js-yaml: ^4.1.0` (runtime dependency)
- **Added**: `@types/js-yaml: ^4.0.5` (dev dependency)

### 8. Created Local Logging Utilities
**New Files**:
- `packages/@unscrambled/cli/src/logging/PrefixedRedactedConsole.ts` - Simplified version of the console wrapper without server streaming
- `packages/@unscrambled/cli/src/logging/utils.ts` - Utility functions (argsToStr, redactSecrets, isString, isObject, isArray)

**Updated**: `packages/@unscrambled/cli/src/logging.ts`
- Now imports from local `./logging/PrefixedRedactedConsole` instead of lightyear package

### 9. Updated All CLI Imports
Replaced all imports from `@unscrambled/lightyear` throughout the CLI package with local implementations:
- 23 files updated to use local `getApiKey`, `getBaseUrl`, and `getEnvName`
- All shared utility files now use local implementations
- All command files now use local implementations

## Backward Compatibility
The implementation maintains backward compatibility:
- Environment variables (`LIGHTYEAR_API_KEY`, `BASE_URL`) still work if the config file doesn't exist
- This allows for gradual migration and supports CI/CD environments that use environment variables

## User Experience
When users run commands without being authenticated, they now see:
```
❌ Authentication required

You need to log in or sign up before using this command.

To get started, run one of the following commands:
  lightyear login
  lightyear signup
```

## Testing
All existing tests pass:
- ✅ Linting: All packages pass
- ✅ Build: All packages build successfully
- ✅ TypeScript compilation: No errors
