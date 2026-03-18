# OAuth Connector Builder

This document describes the OAuth connector builder functionality for the Unscrambled SDK, which provides a fluent API for creating OAuth connectors and integrating them with custom apps.

## Overview

The OAuth connector builder provides a fluent, type-safe way to:

1. **Define OAuth connectors** - Configure OAuth endpoints and parameters
2. **Build connector factories** - Create reusable connector instance factories
3. **Integrate with custom apps** - Attach OAuth connectors to custom app definitions
4. **Flexible scopes** - Support for array-based scopes with customizable separators

## Quick Start

```typescript
import { defineOAuth2CustomApp, defineOAuthConnector } from "@unscrambled/sdk";

// Create OAuth connector with array-based scopes
const myConnector = defineOAuthConnector("MyAPI")
  .withAuthUrl("https://api.example.com/oauth/authorize")
  .withTokenUrl("https://api.example.com/oauth/token")
  .withScope(["read", "write", "admin"])
  .withScopeConnector(" ") // Space-separated scopes
  .build();

// Create custom app with OAuth connector
const myApp = defineOAuth2CustomApp("my-api-app")
  .withTitle("My API Integration")
  .withOAuthConnector(myConnector)
  .deploy();
```

## OAuth Connector Builder API

### Basic Configuration

```typescript
const connector = defineOAuthConnector("MyConnector")
  .withAuthUrl("https://provider.com/oauth/authorize") // Required
  .withTokenUrl("https://provider.com/oauth/token") // Required
  .withRefreshUrl("https://provider.com/oauth/refresh") // Optional
  .build();
```

### Scope Management

```typescript
const connector = defineOAuthConnector("MyConnector")
  .withAuthUrl("https://provider.com/oauth/authorize")
  .withTokenUrl("https://provider.com/oauth/token")

  // Set all scopes at once (replaces any existing scopes)
  .withScope(["read", "write", "admin"])

  // Add individual scopes (no duplicates)
  .addScope("delete") // Single scope
  .addScope(["admin", "modify"]) // Multiple scopes at once
  .addScope("read") // Won't be added again

  // Set scope separator (default is space " ")
  .withScopeConnector(",") // Comma-separated: "read,write,admin"
  // .withScopeConnector(" ") // Space-separated: "read write admin" (default)
  // .withScopeConnector("+") // Plus-separated: "read+write+admin"

  .build();
```

### Adding Parameters

```typescript
const connector = defineOAuthConnector("MyConnector")
  .withAuthUrl("https://provider.com/oauth/authorize")
  .withTokenUrl("https://provider.com/oauth/token")

  // Add authorization parameters
  .withAuthParams({
    prompt: "consent",
    access_type: "offline",
    response_mode: "query",
  })

  // Add token request parameters
  .withTokenParams({
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
  })

  // Add custom headers
  .withHeaders({
    "User-Agent": "MyApp/1.0",
    Accept: "application/json",
  })

  .build();
```

### Building Connectors

The builder provides a simple build method:

```typescript
// Build a factory function
const connectorFactory = builder.build();
const instance = connectorFactory(props);
```

## Common OAuth Provider Examples

Here are examples for configuring popular OAuth providers:

### Google APIs

```typescript
const googleConnector = defineOAuthConnector("MyGoogleApp")
  .withAuthUrl("https://accounts.google.com/o/oauth2/v2/auth")
  .withTokenUrl("https://oauth2.googleapis.com/token")
  .withScopeConnector(" ") // Google uses space-separated scopes
  .withScope([
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
  ])
  .withAuthParams({
    access_type: "offline",
    prompt: "consent",
  })
  .build();
```

### GitHub

```typescript
const githubConnector = defineOAuthConnector("MyGitHubApp")
  .withAuthUrl("https://github.com/login/oauth/authorize")
  .withTokenUrl("https://github.com/login/oauth/access_token")
  .withScopeConnector(" ") // GitHub uses space-separated scopes
  .withScope(["repo", "user", "workflow"])
  .withHeaders({
    Accept: "application/json",
  })
  .build();
```

### Microsoft/Azure

```typescript
const microsoftConnector = defineOAuthConnector("MyMicrosoftApp")
  .withAuthUrl(
    "https://login.microsoftonline.com/your-tenant-id/oauth2/v2.0/authorize"
  )
  .withTokenUrl(
    "https://login.microsoftonline.com/your-tenant-id/oauth2/v2.0/token"
  )
  .withScopeConnector(" ") // Microsoft uses space-separated scopes
  .withScope([
    "https://graph.microsoft.com/Mail.Read",
    "https://graph.microsoft.com/User.Read",
  ])
  .build();
```

### Slack

```typescript
const slackConnector = defineOAuthConnector("MySlackApp")
  .withAuthUrl("https://slack.com/oauth/v2/authorize")
  .withTokenUrl("https://slack.com/api/oauth.v2.access")
  .withScopeConnector(",") // Slack uses comma-separated scopes
  .withScope(["channels:read", "users:read", "chat:write"])
  .build();
```

## Scope Connectors by Provider

Different OAuth providers use different scope separators:

| Provider  | Separator    | Example                               |
| --------- | ------------ | ------------------------------------- |
| Google    | Space `" "`  | `openid profile email`                |
| GitHub    | Space `" "`  | `repo user workflow`                  |
| Microsoft | Space `" "`  | `User.Read Mail.Read`                 |
| Slack     | Comma `","`  | `channels:read,users:read,chat:write` |
| Custom    | Configurable | `read+write+admin` (with `"+"`)       |

## Custom App Integration

### Basic Integration

```typescript
const customApp = defineOAuth2CustomApp("my-app")
  .withTitle("My Application")
  .withOAuthConnector(connectorFactory)
  .deploy();
```

### With Variables and Secrets

```typescript
const customApp = defineOAuth2CustomApp("advanced-app")
  .withTitle("Advanced Application")
  .withOAuthConnector(connectorFactory)

  // Add configuration variables
  .addVariable("apiVersion", {
    title: "API Version",
    description: "Version of the API to use",
    defaultValue: "v1",
    required: true,
  })

  // Add secrets
  .addSecret("webhookSecret", {
    title: "Webhook Secret",
    description: "Secret for webhook verification",
    required: false,
  })

  .deploy();
```

## Complete Examples

### Google Drive Integration

```typescript
const googleDriveConnector = defineOAuthConnector("GoogleDrive")
  .withAuthUrl("https://accounts.google.com/o/oauth2/v2/auth")
  .withTokenUrl("https://oauth2.googleapis.com/token")
  .withScopeConnector(" ")
  .withScope([
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
  ])
  .withAuthParams({
    access_type: "offline",
    prompt: "consent",
  })
  .build();

const googleDriveApp = defineOAuth2CustomApp("google-drive")
  .withTitle("Google Drive Integration")
  .withOAuthConnector(googleDriveConnector)
  .addVariable("folderName", {
    title: "Default Folder",
    description: "Default folder for file operations",
    defaultValue: "Unscrambled",
  })
  .deploy();
```

### GitHub Integration

```typescript
const githubConnector = defineOAuthConnector("GitHub")
  .withAuthUrl("https://github.com/login/oauth/authorize")
  .withTokenUrl("https://github.com/login/oauth/access_token")
  .withScopeConnector(" ")
  .withScope(["repo", "user", "workflow"])
  .withHeaders({
    Accept: "application/json",
  })
  .build();

const githubApp = defineOAuth2CustomApp("github-integration")
  .withTitle("GitHub Integration")
  .withOAuthConnector(githubConnector)
  .addVariable("organization", {
    title: "GitHub Organization",
    description: "GitHub organization name",
    required: true,
  })
  .deploy();
```

### Incremental Scope Building

```typescript
const incrementalConnector = defineOAuthConnector("IncrementalAPI")
  .withAuthUrl("https://api.example.com/oauth/authorize")
  .withTokenUrl("https://api.example.com/oauth/token")
  .addScope("read") // Single scope
  .addScope(["write", "admin"]) // Multiple scopes at once
  .addScope("delete") // Another single scope
  .withScopeConnector("+") // Use plus separator
  .build();
// Results in scope: "read+write+admin+delete"
```

### Custom Scope Separators

```typescript
// Comma-separated scopes
const commaConnector = defineOAuthConnector("CommaAPI")
  .withAuthUrl("https://api.example.com/oauth/authorize")
  .withTokenUrl("https://api.example.com/oauth/token")
  .withScope(["read", "write", "delete"])
  .withScopeConnector(",")
  .build();
// Results in scope: "read,write,delete"

// Plus-separated scopes
const plusConnector = defineOAuthConnector("PlusAPI")
  .withAuthUrl("https://api.example.com/oauth/authorize")
  .withTokenUrl("https://api.example.com/oauth/token")
  .withScope(["read", "write", "delete"])
  .withScopeConnector("+")
  .build();
// Results in scope: "read+write+delete"
```

## CLI Integration

Custom apps with OAuth connectors automatically work with CLI operations:

- `execGetAuthRequestUrl` - Generates authorization URLs
- `execRequestAccessToken` - Exchanges codes for tokens
- `execRefreshAccessToken` - Refreshes expired tokens

The CLI will automatically discover and use the OAuth connector configured for each custom app.

## Advanced Usage

### Custom OAuth Flows

For OAuth flows that require special handling, you can extend the base connector:

```typescript
import { OAuthConnector, OAuthConnectorProps } from "@unscrambled/sdk";

class CustomOAuthConnector extends OAuthConnector {
  constructor(props: OAuthConnectorProps) {
    super(props);
  }

  getAuthRequestUrlBase(): string {
    return "https://api.example.com/oauth/authorize";
  }

  getAccessTokenUrl(): string {
    return "https://api.example.com/oauth/token";
  }

  // Override methods for custom behavior
  getAuthRequestUrlParams(): Record<string, string> {
    const baseParams = super.getAuthRequestUrlParams();
    return {
      ...baseParams,
      custom_param: "custom_value",
    };
  }
}

// Use as factory function
const customConnectorFactory = (props: OAuthConnectorProps) =>
  new CustomOAuthConnector(props);
```

## Type Safety

All builders provide full TypeScript support:

```typescript
// Type-safe configuration
const connector = defineOAuthConnector("TypeSafe")
  .withAuthUrl("https://api.example.com/oauth/authorize") // string
  .withScope(["read", "write"]) // string[]
  .withScopeConnector(",") // string
  .withAuthParams({ prompt: "consent" }) // Record<string, string>
  .build(); // (props) => OAuthConnector

// Type-safe custom app
const app = defineOAuth2CustomApp("typed-app") // CustomAppBuilder
  .withOAuthConnector(connector) // OAuthConnectorFactory
  .deploy(); // CustomApp
```

## Error Handling

The builder validates configuration and provides helpful error messages:

```typescript
// Missing required URLs
const invalid = defineOAuthConnector("Invalid")
  // .withAuthUrl() - Missing!
  .withTokenUrl("https://api.example.com/token")
  .build(); // Throws: OAuth connector 'Invalid' missing authorization URL
```

## Best Practices

1. **Use array-based scopes** for better readability and maintainability
2. **Configure appropriate scope connectors** for your OAuth provider
3. **Use addScope()** for conditional or incremental scope building
4. **Add variables and secrets** to make apps configurable
5. **Use descriptive names** for connectors and apps
6. **Test authorization flows** in development environment
7. **Handle token refresh** properly in long-running processes

## See Also

- [OAuth Connector Documentation](./OAUTH_CONNECTOR.md) - Base OAuth connector functionality
- [Custom App Builder](./CUSTOM_APP.md) - Custom app builder documentation
- [CLI Integration](./CLI_INTEGRATION.md) - CLI operation integration
