# Lightyear Deploy Request Schema

This document describes the expected schema for deployment requests to the Lightyear platform API.

## Overview

The deployment API accepts an array of deployment items, where each item represents a different type of resource (collection, custom app, integration, etc.). The schema is validated server-side using Zod.

## Base Structure

```typescript
Array<DeploymentItem>;

interface DeploymentItem {
  type:
    | "action"
    | "auth"
    | "authorizer"
    | "collection"
    | "customApp"
    | "integration"
    | "variable"
    | "secret"
    | "webhook";
  actionProps?: DeployActionProps;
  authProps?: AuthProps;
  collectionProps?: CollectionProps;
  customAppProps?: CustomAppProps;
  integrationProps?: IntegrationProps;
  webhookProps?: WebhookProps;
  authorizerProps?: AuthorizerProps;
}
```

## Common Validation Rules

### Name Validation

- **NameSchema**: `string().min(1).regex(validNameRegex)`
- **TitleSchema**: `string().min(1)`
- **VariableAndSecretNameSchema**: Either a string or an object with name and optional description

### Variable/Secret Format

```typescript
type VariableOrSecret =
  | string
  | {
      name: string;
      description?: string;
    };
```

## Match Patterns

The `MatchOn` schema supports various matching strategies:

```typescript
type MatchOn =
  | string // Single property
  | string[] // Nested property path
  | { AND: MatchOnSingleProperty[] } // All must match
  | { OR: MatchOnSingleProperty[] } // Any must match
  | { OVERLAP: string }; // Overlap matching
```

### Examples

```typescript
// Simple property match
matchOn: "email";

// Nested property match
matchOn: ["contact", "email"];

// Compound matching
matchOn: {
  AND: ["email", "phone"];
}
matchOn: {
  OR: ["email", "id"];
}
matchOn: {
  OVERLAP: "tags";
}
```

## Deployment Item Types

### 1. Collection (`type: "collection"`)

**Required Props**: `collectionProps`

```typescript
interface CollectionProps {
  name: string; // Must match validNameRegex
  title: string; // Min length 1
  models?: Model[]; // Array of model definitions
}

interface Model {
  name: string; // Must match validNameRegex
  title: string; // Min length 1
  schema?: unknown; // JSON Schema (optional)
  matchOn?: MatchOn; // Matching strategy (optional)
}
```

**Example**:

```json
{
  "type": "collection",
  "collectionProps": {
    "name": "crm",
    "title": "CRM Collection",
    "models": [
      {
        "name": "contact",
        "title": "Contact",
        "schema": {
          "type": "object",
          "properties": {
            "email": { "type": "string", "format": "email" }
          }
        },
        "matchOn": "email"
      }
    ]
  }
}
```

### 2. Custom App (`type: "customApp"`)

**Required Props**: `customAppProps`

```typescript
interface CustomAppProps {
  name: string; // Must match validNameRegex
  title: string; // Min length 1
  authType: "OAUTH2" | "APIKEY" | "BASIC"; // Required
  hasOAuth?: boolean; // Optional
  hasAppWebhook?: boolean; // Optional
  variables?: VariableOrSecret[]; // Optional
  secrets?: VariableOrSecret[]; // Optional
}
```

**Example**:

```json
{
  "type": "customApp",
  "customAppProps": {
    "name": "github-app",
    "title": "GitHub Integration",
    "authType": "OAUTH2",
    "hasOAuth": true,
    "secrets": [
      {
        "name": "client_id",
        "description": "OAuth Client ID"
      },
      "client_secret"
    ]
  }
}
```

### 3. Integration (`type: "integration"`)

**Required Props**: `integrationProps`

```typescript
interface IntegrationProps {
  name: string; // Must match validNameRegex
  title: string; // Min length 1
  description?: string; // Optional
  app?: string; // Must be in available apps list
  customApp?: string; // Must match validNameRegex
  collection: string; // Collection name (required)
  actions?: string[]; // Array of action names
  webhooks?: string[]; // Array of webhook names
  syncSchedules?: SyncSchedule[]; // Array of sync schedules
  readOnly?: boolean; // If true, entire integration is read-only (skip push operations)
  writeOnly?: boolean; // If true, entire integration is write-only (skip pull operations)
  modelPermissions?: Array<{
    model: string; // Model name
    readOnly?: boolean; // If true, this model is read-only
    writeOnly?: boolean; // If true, this model is write-only
  }>; // Array of model-specific permissions
}

interface SyncSchedule {
  type: "INCREMENTAL" | "FULL" | "BASELINE"; // Required
  every?: number | string; // Optional - interval as number (seconds) or string (e.g., "5 minutes")
  maxRetries?: number; // Required when type is "BASELINE" - non-negative integer
}
```

**Example**:

```json
{
  "type": "integration",
  "integrationProps": {
    "name": "salesforce-sync",
    "title": "Salesforce CRM Sync",
    "description": "Sync contacts and accounts with Salesforce",
    "app": "salesforce",
    "collection": "crm",
    "actions": ["sync-contacts", "sync-accounts"],
    "syncSchedules": [
      { "type": "INCREMENTAL", "every": "5 minutes" },
      { "type": "FULL", "every": "1 day" },
      { "type": "BASELINE", "maxRetries": 3 }
    ]
  }
}
```

**Example with read-only configuration**:

```json
{
  "type": "integration",
  "integrationProps": {
    "name": "hubspot-read-only",
    "title": "HubSpot Read-Only Sync",
    "app": "hubspot",
    "collection": "crm",
    "readOnly": true
  }
}
```

**Example with model-specific permissions**:

```json
{
  "type": "integration",
  "integrationProps": {
    "name": "hubspot-mixed",
    "title": "HubSpot Mixed Permissions",
    "app": "hubspot",
    "collection": "crm",
    "modelPermissions": [
      { "model": "owner", "readOnly": true },
      { "model": "contact", "readOnly": false },
      { "model": "event", "writeOnly": true }
    ]
  }
}
```

**Sync Schedule Notes**:

- `type`: Specifies the sync type:
  - `"INCREMENTAL"`: Only sync changes since last run
  - `"FULL"`: Sync all data
  - `"BASELINE"`: Baseline sync that requires `maxRetries` parameter
- `every`: Optional interval for automatic sync execution
  - Can be a **number** representing seconds (e.g., `300` for 5 minutes)
  - Can be a **string** in human-readable format (e.g., `"5 minutes"`, `"1 day"`, `"1 week"`)
  - If omitted, the sync schedule can be triggered manually or by other means
- `maxRetries`: Required when `type` is `"BASELINE"` - non-negative integer specifying maximum retry attempts

### 4. Action (`type: "action"`)

**Required Props**: `actionProps`

```typescript
interface DeployActionProps {
  name: string; // Must match validNameRegex
  title: string; // Min length 1
  description?: string; // Optional
  type: "FULL_SYNC" | "INCREMENTAL_SYNC" | null; // Action type (null if not set)
  trigger?: ActionTrigger; // Optional trigger config
  apps?: string[]; // Must be in available apps
  customApps?: string[]; // Must match validNameRegex
  variables?: VariableOrSecret[]; // Optional
  secrets?: VariableOrSecret[]; // Optional
}

interface ActionTrigger {
  webhook?: string; // Webhook trigger
  pollingFrequency?: number; // Positive integer (polling)
}
```

**Example with type:**

```json
{
  "type": "action",
  "actionProps": {
    "name": "sync-contacts",
    "title": "Sync Contacts",
    "description": "Sync contacts from external system",
    "type": "FULL_SYNC",
    "trigger": {
      "pollingFrequency": 300
    },
    "apps": ["salesforce"],
    "variables": ["batch_size"]
  }
}
```

**Example without type (null):**

```json
{
  "type": "action",
  "actionProps": {
    "name": "process-data",
    "title": "Process Data",
    "description": "Process data from external system",
    "type": null,
    "apps": ["salesforce"]
  }
}
```

### 5. Webhook (`type: "webhook"`)

**Required Props**: `webhookProps`

```typescript
interface WebhookProps {
  name: string; // Must match validNameRegex
  title: string; // Min length 1
  apps?: string[]; // Must be in available apps
  customApps?: string[]; // Must match validNameRegex
  variables?: VariableOrSecret[]; // Optional
  secrets?: VariableOrSecret[]; // Optional
}
```

### 6. Authorizer (`type: "authorizer"`)

**Required Props**: `authorizerProps`

```typescript
interface AuthorizerProps {
  customApp: string; // Must match validNameRegex (required)
}
```

### 7. Auth (`type: "auth"`)

**Required Props**: `authProps`

```typescript
interface AuthProps {
  name: string; // Must match validNameRegex
  app?: string; // Must be in available apps
  customApp?: string; // Must match validNameRegex
}
```

## Validation Rules

### 1. Type-Props Correspondence

Each deployment item must have the corresponding props for its type:

- `type: "collection"` → `collectionProps` required
- `type: "customApp"` → `customAppProps` required
- `type: "integration"` → `integrationProps` required
- etc.

### 2. App Name Validation

- `app` fields must reference apps available to the user in the environment
- `customApp` fields must reference custom apps defined in the same deployment

### 3. Name Format Validation

- All `name` fields must match `validNameRegex`
- Variable and secret names must match `validVariableAndSecretNameRegex`

### 4. Required vs Optional

- `name` and `title` are required for most resource types
- Most other fields are optional and can be omitted

## SDK Implementation Notes

Our SDK's deployment handler should transform registry items to match this schema:

### Current SDK → API Mapping

| SDK Builder          | API Type        | Props Field                |
| -------------------- | --------------- | -------------------------- |
| `ModelBuilder`       | N/A             | Models go into collections |
| `CollectionBuilder`  | `"collection"`  | `collectionProps`          |
| `CustomAppBuilder`   | `"customApp"`   | `customAppProps`           |
| `IntegrationBuilder` | `"integration"` | `integrationProps`         |

### Missing API Types in SDK

The following API types don't have corresponding SDK builders yet:

- `"action"` → Need `ActionBuilder`
- `"webhook"` → Need `WebhookBuilder`
- `"auth"` → Need `AuthBuilder`
- `"authorizer"` → Need `AuthorizerBuilder`
- `"variable"` → Global variables
- `"secret"` → Global secrets

### Important Notes

#### OAuth Connector Detection

When custom apps include OAuth connectors (created with `defineOAuthConnector` and attached via `.withOAuthConnector()`), the deployment handler automatically sets `hasOAuth: true` in the deployment schema. Apps without OAuth connectors will have `hasOAuth` undefined.

**Example**:

```typescript
// SDK Builder
const oauthConnector = defineOAuthConnector("GitHub")
  .withAuthUrl("https://github.com/login/oauth/authorize")
  .withTokenUrl("https://github.com/login/oauth/access_token")
  .build();

const app = defineOAuth2CustomApp("github-app")
  .withOAuthConnector(oauthConnector) // ← OAuth connector provided
  .deploy();

// Deployment Schema Result
// hasOAuth: true (automatically set)
```

#### Collections vs Integrations

In our SDK, `IntegrationBuilder` requires a collection via `.withCollection()` method. The API schema treats integrations and collections as separate deployment items, with integrations referencing a collection by name:

- **SDK**: Integration contains a collection reference directly
- **API**: Integration references collection by name, collections deployed separately

This means when deploying:

1. Collections get deployed as separate `"collection"` items
2. Integrations get deployed as `"integration"` items with collection name reference
3. The platform links them together based on the collection name
4. **Each integration must be associated with exactly one collection**

#### Built-in vs Custom Apps

Our SDK's `Integration.app` object contains `{ type, name, definition }`, but the API expects:

- `app: string` for built-in apps (e.g., `"salesforce"`)
- `customApp: string` for custom apps (references custom app name)

The deployment handler automatically transforms between these formats.

## Example Complete Deployment

```json
[
  {
    "type": "customApp",
    "customAppProps": {
      "name": "github-app",
      "title": "GitHub Integration",
      "authType": "OAUTH2",
      "hasOAuth": true,
      "secrets": ["client_id", "client_secret"]
    }
  },
  {
    "type": "collection",
    "collectionProps": {
      "name": "repositories",
      "title": "GitHub Repositories",
      "models": [
        {
          "name": "repository",
          "title": "Repository",
          "matchOn": "full_name"
        }
      ]
    }
  },
  {
    "type": "integration",
    "integrationProps": {
      "name": "github-sync",
      "title": "GitHub Repository Sync",
      "customApp": "github-app",
      "collection": "repositories",
      "description": "Sync GitHub repositories"
    }
  }
]
```

## Error Handling

The API will return validation errors if:

- Required props are missing for a type
- Names don't match regex patterns
- Referenced apps/customApps don't exist
- Invalid enum values are provided
- Schema structure is malformed

Common validation error format:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": ["0", "collectionProps", "name"],
      "message": "Invalid name format"
    }
  ]
}
```
