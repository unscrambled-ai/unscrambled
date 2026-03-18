# Lightyear SDK

TypeScript SDK for building integrations with Lightyear.

## Features

- **Builders** - Fluent API for defining integrations, actions, and custom apps
- **OAuth Connectors** - Built-in OAuth2 authentication with configurable endpoints
- **Type Safety** - Full TypeScript support with comprehensive type definitions
- **CLI Integration** - Seamless integration with Lightyear CLI operations
- **Registry** - Automatic registration and discovery of components

## Installation

```bash
npm install @runlightyear/sdk
```

## Quick Start

### OAuth Custom App

```typescript
import { defineOAuth2CustomApp, defineOAuthConnector } from "@runlightyear/sdk";

// Create OAuth connector for Google APIs
const googleConnector = defineOAuthConnector("GoogleDrive")
  .withAuthUrl("https://accounts.google.com/o/oauth2/v2/auth")
  .withTokenUrl("https://oauth2.googleapis.com/token")
  .withScopeConnector(" ")
  .withScope(["https://www.googleapis.com/auth/drive"])
  .withAuthParams({
    access_type: "offline",
    prompt: "consent",
  })
  .build();

// Define custom app with OAuth connector
const googleDriveApp = defineOAuth2CustomApp("google-drive")
  .withTitle("Google Drive Integration")
  .withOAuthConnector(googleConnector)
  .addVariable("folderName", {
    title: "Default Folder",
    defaultValue: "Lightyear",
  })
  .deploy();
```

### Integrations with Sync Schedules

```typescript
import {
  defineIntegration,
  defineCollection,
  defineAction,
} from "@runlightyear/sdk";

// Define a collection
const crmCollection = defineCollection("crm")
  .addModel("contact")
  .addModel("account")
  .deploy();

// Define an action
const syncAction = defineAction("sync-data")
  .withTitle("Sync Data")
  .withRun(async ({ auths }) => {
    console.log("Syncing data...");
  })
  .deploy();

// Define an integration with sync schedules (object-based API)
const integration = defineIntegration("salesforce-sync")
  .withTitle("Salesforce CRM Sync")
  .withApp("salesforce")
  .withCollection(crmCollection)
  .withAction(syncAction)
  .withSyncSchedules({
    incremental: { every: "5 minutes" },
    full: { every: "1 day" },
    baseline: { maxRetries: 3 },
  })
  .deploy();

// Alternative: array-based API
const integration2 = defineIntegration("hubspot-sync")
  .withTitle("HubSpot Sync")
  .withApp("hubspot")
  .withCollection(crmCollection)
  .withSyncSchedules([
    { type: "INCREMENTAL", every: "5 minutes" },
    { type: "FULL", every: "1 day" },
    { type: "BASELINE", maxRetries: 3 },
  ])
  .deploy();
```

Sync schedules support:

- **Type**: 
  - `"INCREMENTAL"` for delta syncs (only changes)
  - `"FULL"` for complete syncs (all data)
  - `"BASELINE"` for baseline syncs (requires `maxRetries` parameter)
- **Interval**: Can be a number (seconds) or string (e.g., "5 minutes", "1 day", "1 week")
- **maxRetries**: Required for `"BASELINE"` type - non-negative integer specifying maximum retry attempts
- **Object API**: Pass `{ incremental: {...}, full: {...}, baseline: { maxRetries: N } }` for a cleaner syntax
- **Array API**: Pass an array of schedule objects for more flexibility
- Multiple schedules per integration

### Custom OAuth Connector

```typescript
import { defineOAuthConnector } from "@runlightyear/sdk";

const customConnector = defineOAuthConnector("MyAPI")
  .withAuthUrl("https://api.example.com/oauth/authorize")
  .withTokenUrl("https://api.example.com/oauth/token")
  .withScope("read write")
  .withAuthParams({
    prompt: "consent",
    access_type: "offline",
  })
  .buildFactory();
```

## Documentation

- [OAuth Connector](./OAUTH_CONNECTOR.md) - Base OAuth connector functionality
- [OAuth Builder](./OAUTH_BUILDER.md) - OAuth connector builder documentation
- [Examples](./examples/) - Complete working examples

## CLI Integration

OAuth connectors automatically work with Lightyear CLI operations:

- `execGetAuthRequestUrl` - Generates authorization URLs
- `execRequestAccessToken` - Exchanges codes for tokens
- `execRefreshAccessToken` - Refreshes expired tokens

## Common OAuth Providers

Examples for popular OAuth providers:

```typescript
import { defineOAuthConnector } from "@runlightyear/sdk";

// Google APIs
const google = defineOAuthConnector("Google")
  .withAuthUrl("https://accounts.google.com/o/oauth2/v2/auth")
  .withTokenUrl("https://oauth2.googleapis.com/token")
  .withScopeConnector(" ")
  .withAuthParams({
    access_type: "offline",
    prompt: "consent",
  })
  .build();

// GitHub
const github = defineOAuthConnector("GitHub")
  .withAuthUrl("https://github.com/login/oauth/authorize")
  .withTokenUrl("https://github.com/login/oauth/access_token")
  .withScopeConnector(" ")
  .withHeaders({
    Accept: "application/json",
  })
  .build();

// Slack
const slack = defineOAuthConnector("Slack")
  .withAuthUrl("https://slack.com/oauth/v2/authorize")
  .withTokenUrl("https://slack.com/api/oauth.v2.access")
  .withScopeConnector(",")
  .build();
```

## License

MIT
