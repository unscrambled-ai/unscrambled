# OAuth Connector for SDK

This document describes the OAuth connector implementation for the Unscrambled SDK, which provides OAuth2 authentication functionality that integrates with the existing CLI operations.

## Overview

The OAuthConnector provides the essential OAuth2 operations:

1. **Generate auth request URL** - Creates the authorization URL for users to grant permissions
2. **Exchange code for access token** - Converts authorization codes into access tokens
3. **Refresh access token** - Refreshes expired access tokens using refresh tokens

## Key Features

- **Configurable base URLs** - Override default OAuth endpoints via `baseUrls` configuration
- **CLI Integration** - Works seamlessly with existing CLI operations (`execGetAuthRequestUrl`, `execRequestAccessToken`, `execRefreshAccessToken`)
- **Abstract base class** - Extend for different OAuth providers
- **Type-safe** - Full TypeScript support with proper interfaces
- **Error handling** - Comprehensive error handling with structured responses

## Usage

### 1. Create a Custom OAuth Connector

```typescript
import { OAuthConnector, OAuthConnectorProps } from "@unscrambled/sdk";

class MyOAuthConnector extends OAuthConnector {
  constructor(props: OAuthConnectorProps) {
    super(props);
  }

  // Required: Define the authorization endpoint
  getAuthRequestUrlBase(): string {
    return "https://api.example.com/oauth/authorize";
  }

  // Required: Define the token endpoint
  getAccessTokenUrl(): string {
    return "https://api.example.com/oauth/token";
  }

  // Optional: Customize authorization parameters
  getAuthRequestUrlParams(): Record<string, string> {
    const baseParams = super.getAuthRequestUrlParams();
    return {
      ...baseParams,
      scope: "read write admin", // Add custom scopes
    };
  }
}
```

### 2. Configure Base URLs

You can override default endpoints using the `baseUrls` configuration:

```typescript
const connector = new MyOAuthConnector({
  customAppName: "my-app",
  oauthConfigData: {
    clientId: "your-client-id",
    clientSecret: "your-client-secret",
  },
  authData: {
    customAppName: "my-app",
    authName: "oauth-auth",
    state: "random-state-string",
  },
  baseUrls: {
    authRequestUrl: "https://custom.example.com/oauth/authorize",
    accessTokenUrl: "https://custom.example.com/oauth/token",
    refreshTokenUrl: "https://custom.example.com/oauth/refresh",
  },
});
```

### 3. Basic Operations

```typescript
// Generate authorization URL
const authUrl = connector.getAuthRequestUrl();
console.log("Visit:", authUrl);

// Exchange authorization code for tokens
const tokenData = await connector.requestAccessToken(authorizationCode);

// Refresh expired tokens
const refreshedData = await connector.refreshAccessToken();
```

### 4. Integration with CLI Operations

The connector integrates with existing CLI operations that call:

- `execGetAuthRequestUrl` - Gets auth request URL
- `execRequestAccessToken` - Exchanges code for access token
- `execRefreshAccessToken` - Refreshes access token

These CLI operations will work with any connector that extends `OAuthConnector`.

## Handler Integration

The SDK provides handlers that can be called by the CLI:

```typescript
import {
  handleGetAuthRequestUrl,
  handleRequestAccessToken,
  handleRefreshAccessToken,
} from "@unscrambled/sdk";

// Get auth request URL
const result = await handleGetAuthRequestUrl({
  customAppName: "my-app",
  authName: "oauth-auth",
  oauthConfigData: {
    /* config */
  },
  authData: {
    /* auth data */
  },
  oauthConnector: connectorInstance,
});
```

## Interfaces

### OAuthConnectorProps

```typescript
interface OAuthConnectorProps {
  appName?: string;
  customAppName?: string;
  oauthConfigData: OAuthConfigData;
  authData?: AuthData;
  inDevelopment?: boolean;
  proxied?: boolean;
  baseUrls?: OAuthConnectorBaseUrls;
}
```

### OAuthConfigData

```typescript
interface OAuthConfigData {
  clientId: string | null;
  clientSecret: string | null;
  authRequestUrl?: string | null;
}
```

### OAuthConnectorBaseUrls

```typescript
interface OAuthConnectorBaseUrls {
  authRequestUrl?: string;
  accessTokenUrl?: string;
  refreshTokenUrl?: string;
}
```

### AuthData

```typescript
interface AuthData {
  appName?: string;
  customAppName?: string;
  managedUser?: string;
  authName?: string;
  tokenType?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  refreshedAt?: string;
  apiKey?: string | null;
  username?: string | null;
  password?: string | null;
  state?: string;
}
```

## HTTP Implementation

The connector uses a simplified HTTP implementation that:

- Supports standard HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Includes retry logic with exponential backoff
- Handles rate limiting (429 responses)
- Provides error handling with structured responses
- Supports request/response redaction for security

## Error Handling

The connector provides structured error responses:

```typescript
// Success response
{
  success: true,
  data: { authRequestUrl: "https://..." },
  logs: ["[INFO] Generated auth request URL successfully"]
}

// Error response
{
  success: false,
  error: "Missing customAppName",
  logs: ["[ERROR] Missing customAppName"]
}
```

## Example Implementation

See `examples/oauth-connector-example.ts` for a complete working example showing how to implement and use a custom OAuth connector.
