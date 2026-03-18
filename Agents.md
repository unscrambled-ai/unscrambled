# Lightyear Integration Platform - Architecture Guide

## Overview

Lightyear is an integration platform that enables developers to build powerful API integrations using TypeScript with minimal boilerplate. The platform provides built-in authentication, data synchronization, and serverless infrastructure, abstracting away the complexity of API automation.

## Repository Structure

This is a monorepo managed with **pnpm workspaces** and **Turbo**. The workspace contains:

### Core Packages (`packages/@unscrambled/`)

1. **`sdk/`** - The modern TypeScript SDK (actively developed)
2. **`lightyear/`** - Legacy SDK (deprecated, not to be modified, but can be used as reference)
3. **`cli/`** - Command-line interface for development and deployment
4. **`hubspot/`** - Pre-built HubSpot integration connector
5. **`salesforce/`** - Pre-built Salesforce integration connector

### Applications (`apps/`)

- **`docs/`** - Docusaurus documentation site

### Utility Packages (`packages/util/`)

- `eslint-config-custom` - Shared ESLint configuration
- `tsconfig` - Shared TypeScript configurations
- `tsdoc-config` - TSDoc configuration for documentation
- `api-extractor-config` - API Extractor configuration

## Architecture Overview

### 1. SDK Package (`@unscrambled/sdk`)

The SDK is the heart of the platform, providing a **builder pattern API** for defining integrations. Key principles:

- **Fluent API**: Chainable methods for configuring components
- **Type Safety**: Full TypeScript support with comprehensive type inference
- **Registry Pattern**: Automatic registration and discovery of components
- **Handler System**: Unified interface for CLI and serverless execution

#### Core Concepts

**Components that are deployed:**

- **Custom Apps** - Third-party application definitions with auth configuration
- **Integrations** - Combinations of apps with actions and collections
- **Actions** - Executable functions triggered by events or schedules
- **Collections** - Data models for syncing between systems
- **Models** - Individual data types within collections

**Components that exist in-memory only:**

- **Connectors** - RestConnector, OAuthConnector, SyncConnector
- **Handlers** - Functions that execute operations (run, deploy, oauth, etc.)

#### Builder Pattern

All major components follow the builder pattern:

```typescript
// Example: Action Builder
defineAction("send-notification")
  .withTitle("Send Notification")
  .addVariable("message", { required: true })
  .addSecret("apiKey", { required: true })
  .withRun(async ({ variables, secrets }) => {
    // Action logic
  })
  .deploy();
```

Key builders:

- `ActionBuilder` - Define executable actions
- `CustomAppBuilder` - Define OAuth2/API Key/Basic auth apps
- `IntegrationBuilder` - Define integrations combining apps and actions
- `CollectionBuilder` - Define data collections
- `ModelBuilder` - Define data models with JSON schemas
- `OAuthConnectorBuilder` - Define OAuth2 authentication flows
- `RestConnectorBuilder` - Define REST API clients
- `SyncConnectorBuilder` - Define bidirectional data synchronization

#### Registry System

The SDK maintains a global registry (`src/registry/index.ts`) that tracks all deployed components:

```typescript
class SDKRegistry {
  registerModel(model: Model);
  registerCollection(collection: Collection);
  registerCustomApp(customApp: CustomApp);
  registerIntegration(integration: Integration);
  registerAction(action: Action);

  getModels(): ModelRegistryEntry[];
  getCollections(): CollectionRegistryEntry[];
  getCustomApps(): CustomAppRegistryEntry[];
  getIntegrations(): IntegrationRegistryEntry[];
  getActions(): ActionRegistryEntry[];
}
```

When `.deploy()` is called on a builder, the component is:

1. Built into its final structure
2. Registered in the global registry
3. Made available for deployment to the platform

#### Handler System

Handlers (`src/handlers/index.ts`) provide a unified interface for executing operations. The main handler routes to specific sub-handlers:

```typescript
handler(event: HandlerEvent) {
  switch (event.operation) {
    case "health": return handleHealth()
    case "deploy": return handleDeploy(payload)
    case "run": return handleRun(payload)
    case "getAuthRequestUrl": return handleGetAuthRequestUrl(...)
    case "requestAccessToken": return handleRequestAccessToken(...)
    case "refreshAccessToken": return handleRefreshAccessToken(...)
    case "registry-export": return handleRegistryExport()
    case "registry-stats": return handleRegistryStats()
  }
}
```

All handlers include:

- **Log capture** - Automatic logging with context (runId, deployId, etc.)
- **Error handling** - Structured error responses
- **Status codes** - Lambda-compatible responses (200, 202, 400, 500)

### 2. CLI Package (`@unscrambled/cli`)

The CLI provides developer tooling built on **Commander.js**:

#### Commands

**`create`** - Create new integration project from template

- Clones template repository
- Installs dependencies
- Initializes git repository

**`signup` / `login`** - Authenticate with Lightyear platform

- Opens browser for OAuth authentication
- Starts local server to receive callback
- Stores API key in `.env` file

**`build`** - Compile TypeScript code

- Uses esbuild for fast compilation
- Bundles into single entry point

**`dev`** - Development mode

- Watches for file changes using nodemon
- Automatically rebuilds and deploys to dev environment
- Connects to Pusher for real-time event streaming
- Handles local execution of:
  - Actions (triggered from dashboard)
  - OAuth flows (getAuthRequestUrl, requestAccessToken, refreshAccessToken)
  - Webhooks
  - Subscription management

**`deploy <env>`** - Deploy to production

- Builds the code
- Reads compiled output
- Uploads to platform API
- Waits for deployment to complete

**`trigger`** - Manually trigger actions

- Interactive mode for selecting action
- Passes data to action execution

#### Dev Mode Operation Queue

The dev command uses an operation queue (`src/shared/operationQueue.ts`) to serialize operations:

```typescript
pushOperation({
  operation: "run",
  params: { actionName, runId, data },
});
```

Operations are processed sequentially to prevent race conditions. The CLI communicates with the platform via Pusher channels for real-time event delivery.

#### Pusher Integration

In dev mode, the CLI subscribes to Pusher channels:

- `presence-{devEnvId}` - Presence channel for connection tracking
- `{devEnvId}` - Regular channel for receiving triggers

Events received:

- `localRunTriggered` - Execute an action locally
- `localGetAuthRequestUrlTriggered` - Generate OAuth URL
- `localRequestAccessTokenTriggered` - Exchange OAuth code for token
- `localRefreshAccessTokenTriggered` - Refresh OAuth token
- `localRefreshSubscriptionTriggered` - Refresh webhook subscription
- `localReceiveCustomAppWebhookTriggered` - Receive webhook payload
- `localResubscribeTriggered` - Resubscribe to webhooks

### 3. Connector Architecture

Connectors are the interface between the SDK and external APIs.

#### OAuth Connector (`OAuthConnector`)

Handles OAuth2 authentication flows:

```typescript
class OAuthConnector {
  async getAuthRequestUrl(props): Promise<string>;
  async requestAccessToken(code: string): Promise<TokenResponse>;
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse>;
}
```

Built using the fluent API:

```typescript
defineOAuthConnector("Google")
  .withAuthUrl("https://accounts.google.com/o/oauth2/v2/auth")
  .withTokenUrl("https://oauth2.googleapis.com/token")
  .withScopeConnector(" ")
  .withAuthParams({ access_type: "offline", prompt: "consent" })
  .build();
```

#### REST Connector (`RestConnector`)

Provides HTTP client with built-in features:

- Authentication injection
- Retry logic with exponential backoff
- Rate limiting support (429 handling)
- Request/response redaction for security

```typescript
class RestConnector {
  async get(url: string, options?);
  async post(url: string, data, options?);
  async put(url: string, data, options?);
  async patch(url: string, data, options?);
  async delete(url: string, options?);
}
```

#### Sync Connector (`SyncConnector`)

Orchestrates bidirectional data synchronization:

**Pull Phase** (External System → Lightyear):

1. Calls model's `list()` configuration to fetch data
2. Handles pagination (cursor/page/offset-based)
3. Calls `upsertObjectBatch()` to store in Lightyear
4. Tracks sync progress and state

**Push Phase** (Lightyear → External System):

1. Calls `retrieveDelta()` to get changes from Lightyear
2. Groups changes by operation (create/update/delete)
3. Calls model's `create()`, `update()`, `delete()` configurations
4. Uses `ChangeProcessor` for async batching
5. Calls `confirmChangeBatch()` to acknowledge completion

**Time Limit Handling**:

- Syncs can be paused mid-execution when time limit is reached
- Progress is saved (cursor, page, offset)
- Next run resumes from last position
- Throws `"RERUN"` special value to trigger re-execution

**Sync Modes**:

- `FULL` - Complete data synchronization from scratch
- `INCREMENTAL` - Only sync changes since last run

**Sync Directions**:

- `pull` - External → Lightyear
- `push` - Lightyear → External
- `bidirectional` - Both directions

### 4. Type Safety

The SDK provides extensive type inference:

#### Model Type Inference

```typescript
const collection = defineCollection("contacts")
  .addModel(
    defineModel("contact").withSchema(
      z.object({
        id: z.string(),
        email: z.string().email(),
        name: z.string(),
      })
    )
  )
  .deploy();

// Infer types from models
type ContactData = Infer<typeof collection, "contact">;
// Results in: { id: string; email: string; name: string }
```

#### Typed Action Variables and Secrets

```typescript
defineAction("send-email")
  .addVariable("to", { required: true })
  .addVariable("subject", { required: false })
  .addSecret("apiKey", { required: true })
  .withRun(async ({ variables, secrets }) => {
    // variables.to is string
    // variables.subject is string | null
    // secrets.apiKey is string
  });
```

The builder pattern ensures type safety through TypeScript generics that accumulate configuration.

### 5. Platform Integration

#### Deployment Flow

When code is deployed:

1. **Build Phase** - CLI compiles TypeScript to JavaScript using esbuild
2. **Registry Export** - Handler exports all registered components
3. **Upload Phase** - Compiled code is sent to platform API
4. **Extraction Phase** - Platform extracts component definitions
5. **Database Storage** - Components are stored in platform database
6. **Function Deployment** - Code is deployed to Lambda/VM for execution

#### Execution Flow

When an action is triggered:

1. **Trigger Event** - User clicks "Run" in dashboard or scheduled/webhook trigger fires
2. **Environment Routing**:
   - **Dev**: Event sent via Pusher to local CLI
   - **Prod**: Event sent to Lambda/VM directly
3. **Handler Invocation** - `handler()` function receives event
4. **Action Lookup** - Action name mapped to run function via `globalThis.actionIndex`
5. **Context Injection** - Props injected: `{ auths, variables, secrets, data, context }`
6. **Execution** - Run function executes with full context
7. **Log Capture** - All console logs captured and uploaded in real-time
8. **Result** - Success/error/skipped/rerun status returned

#### Log Capture System

The SDK includes sophisticated log capture (`src/logging/`):

```typescript
class LogCapture {
  setContext(context: { runId?; deployId?; syncId? });
  captureLog(level: string, message: string, args: any[]);
  flush(); // Upload logs to platform
}
```

Features:

- Intercepts `console.log`, `console.info`, `console.warn`, `console.error`
- Adds context (runId, deployId, integrationName, etc.)
- Buffers logs and uploads in batches
- Automatic flushing on completion
- Cancellation support (handles 410 responses)

### 6. Pre-built Connectors

#### HubSpot Package (`@unscrambled/hubspot`)

Pre-configured HubSpot integration:

- OAuth connector with HubSpot-specific scopes
- REST connector for HubSpot API
- Sync connector for CRM objects (contacts, companies, deals)
- Model definitions for common HubSpot objects

#### Salesforce Package (`@unscrambled/salesforce`)

Pre-configured Salesforce integration:

- OAuth connector for Salesforce
- REST connector for Salesforce REST API
- Common object models (Account, Contact, Opportunity, Lead)

## Deprecated: Lightyear Package

The `packages/@unscrambled/lightyear` package is the original SDK implementation. It is **deprecated and should not be modified**.

### Key Differences from SDK

**Global Indexes vs Registry**:

- Lightyear uses global indexes: `globalThis.actionIndex`, `globalThis.deployList`
- SDK uses a proper Registry class for tracking components

**Function-based vs Builder-based**:

- Lightyear uses direct function calls: `defineAction({ name, run })`
- SDK uses builder pattern: `defineAction(name).withRun(run).deploy()`

**Handler vs Individual Functions**:

- Lightyear exports individual handler functions
- SDK provides unified `handler()` with operation routing

**Import from lightyear to SDK**:

- SDK still imports some utilities from lightyear (getApiKey, getBaseUrl, etc.)
- CLI depends on lightyear for certain shared functionality
- This is temporary - lightyear will eventually be fully replaced

### Using Lightyear as Reference

When implementing new features in the SDK:

1. Check lightyear for existing implementations
2. Study the approach and API contracts
3. Re-implement using SDK patterns (builders, registry, handlers)
4. Maintain backward compatibility where needed

Common reference points:

- `lightyear/src/base/` - Core functionality implementations
- `lightyear/src/connectors/` - Connector implementations
- `lightyear/src/handler/` - Handler implementations for comparison

## Development Workflow

### Creating a New Integration

1. **Create project**: `npx @unscrambled/cli create my-integration`
2. **Install dependencies**: `cd my-integration && npm install`
3. **Authenticate**: `npx lightyear login`
4. **Start dev mode**: `npm run dev`
5. **Write integration code** in `src/`:

   ```typescript
   import { defineOAuth2CustomApp, defineAction } from "@unscrambled/sdk";

   const myApp = defineOAuth2CustomApp("my-app")
     .withTitle("My App")
     .withOAuthConnector(myOAuthConnector)
     .deploy();

   defineAction("my-action")
     .withTitle("My Action")
     .withRun(async ({ auths }) => {
       // Action logic
     })
     .deploy();
   ```

6. **Test locally** - Triggers from dashboard execute locally
7. **Deploy to production**: `npm run deploy prod`

### Project Structure

Typical integration project:

```
my-integration/
├── src/
│   ├── index.ts          # Main entry point
│   ├── apps/             # Custom app definitions
│   ├── actions/          # Action definitions
│   ├── integrations/     # Integration definitions
│   └── connectors/       # Custom connectors
├── package.json
├── tsconfig.json
└── .env                  # API key and secrets
```

### Best Practices

1. **Use builders consistently** - Always use `.deploy()` at the end
2. **Type your schemas** - Use Zod for runtime + static type checking
3. **Modularize connectors** - Create reusable connector modules
4. **Test in dev mode** - Use dev mode for rapid iteration
5. **Handle errors gracefully** - Actions should catch and log errors appropriately
6. **Use variables and secrets** - Don't hardcode configuration
7. **Leverage type inference** - Let TypeScript infer types from builders

## Key Files Reference

### SDK Package

- `src/index.ts` - Main entry point with all exports
- `src/builders/index.ts` - All builder exports
- `src/registry/index.ts` - Component registry
- `src/handlers/index.ts` - Main handler router
- `src/types/index.ts` - Core type definitions
- `src/connectors/` - Base connector classes
- `src/logging/` - Log capture system
- `src/platform/` - Platform API integration

### CLI Package

- `src/index.ts` - Main CLI entry point
- `src/commands/` - Command implementations
- `src/shared/` - Shared utilities
- `src/logging.ts` - Terminal output formatting

### Lightyear Package (Deprecated)

- `src/base/` - Base functionality
- `src/connectors/` - Connector implementations
- `src/handler/` - Handler implementations
- Reference only - do not modify

## CLI Conventions

Based on memory preferences, the CLI follows these conventions:

1. **Exit handling**: Use `return` for success, `program.error()` for failures (not `process.exit()`)
2. **Output**: Use `terminal` module for user-facing output, not `console.log`
3. **Prompt positioning**: Prompts always render at bottom; logs render above
4. **Package manager**: Use `pnpm` exclusively

## Additional Documentation

- `packages/@unscrambled/sdk/README.md` - SDK quick start
- `packages/@unscrambled/sdk/OAUTH_CONNECTOR.md` - OAuth connector details
- `packages/@unscrambled/sdk/OAUTH_BUILDER.md` - OAuth builder API
- `packages/@unscrambled/sdk/DEPLOY_SCHEMA.md` - Deployment schema
- `packages/@unscrambled/sdk/docs/` - Additional SDK documentation
- `packages/@unscrambled/sdk/examples/` - Code examples
- `apps/docs/` - Full documentation site

## Common Patterns

### Defining a Custom OAuth App

```typescript
import { defineOAuth2CustomApp, defineOAuthConnector } from "@unscrambled/sdk";

const myOAuthConnector = defineOAuthConnector("MyAPI")
  .withAuthUrl("https://api.example.com/oauth/authorize")
  .withTokenUrl("https://api.example.com/oauth/token")
  .withScope(["read", "write"])
  .build();

const myApp = defineOAuth2CustomApp("my-app")
  .withTitle("My Application")
  .withOAuthConnector(myOAuthConnector)
  .addVariable("apiVersion", { defaultValue: "v1" })
  .deploy();
```

### Defining an Action with Type Safety

```typescript
import { defineAction } from "@unscrambled/sdk";

defineAction("process-order")
  .withTitle("Process Order")
  .addVariable("orderSource", { required: true })
  .addVariable("notifyCustomer", { required: false, defaultValue: "true" })
  .addSecret("webhookSecret", { required: true })
  .withRun(async ({ auths, variables, secrets, data }) => {
    // Variables are typed:
    // variables.orderSource: string
    // variables.notifyCustomer: string | null
    // secrets.webhookSecret: string

    console.log("Processing order from:", variables.orderSource);

    // Action logic here
  })
  .deploy();
```

### Creating a Sync Connector

```typescript
import {
  createSyncConnector,
  defineCollection,
  defineModel,
} from "@unscrambled/sdk";
import { z } from "zod";

const contactSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
});

const collection = defineCollection("contacts")
  .addModel(defineModel("contact").withSchema(contactSchema))
  .deploy();

const syncConnector = createSyncConnector(restConnector, collection)
  .forModel("contact")
  .withList({
    path: "/contacts",
    method: "GET",
    pagination: { type: "cursor", cursorPath: "$.nextCursor" },
    responseSchema: z.object({
      contacts: z.array(contactSchema),
      nextCursor: z.string().optional(),
    }),
    transform: (response) => ({
      items: response.contacts,
      nextCursor: response.nextCursor,
    }),
  })
  .withCreate({
    path: "/contacts",
    method: "POST",
  })
  .withUpdate({
    path: "/contacts/:id",
    method: "PATCH",
  })
  .withDelete({
    path: "/contacts/:id",
    method: "DELETE",
  })
  .build();

// Use in an action
defineAction("sync-contacts")
  .withRun(async () => {
    await syncConnector.sync();
  })
  .deploy();
```

## Platform API Contracts

### Platform Sync APIs

The SDK's SyncConnector interfaces with platform APIs:

**`getSync(syncId)`** - Get sync state and progress

- Returns: `{ syncId, collectionName, status, direction, modelName, state }`

**`updateSync({ syncId, ...updates })`** - Update sync state

- Updates: `currentDirection`, `currentModel`, `state`, `status`

**`upsertObjectBatch({ collectionName, modelName, objects })`** - Store objects

- Batches objects for efficient storage
- Handles deduplication by external ID

**`retrieveDelta({ collectionName, syncId, modelName, limit })`** - Get changes

- Returns: `{ operation: "CREATE" | "UPDATE" | "DELETE", changes: [...] }`
- Changes include full object data

**`confirmChangeBatch({ collectionName, syncId, modelName, changeIds })`** - Acknowledge writes

- Marks changes as successfully pushed
- Prevents duplicate processing

**`pauseSync(syncId)`** - Pause sync for later resumption

**`finishSync(syncId)`** - Mark sync as complete

## Troubleshooting

### Common Issues

**"Unknown operation" error**:

- Ensure handler is exporting `handler` function
- Check that operation name matches handler switch cases

**Types not inferred correctly**:

- Ensure models use `as const` for literal types
- Use Zod schemas for best type inference
- Check that `.deploy()` is called on builders

**OAuth flow not working**:

- Verify OAuth connector URLs are correct
- Check that scopes are properly configured
- Ensure custom app has `withOAuthConnector()` called

**Sync not resuming after time limit**:

- Ensure sync state is being saved properly
- Check that `RERUN` is being thrown correctly
- Verify platform API credentials are valid

**Dev mode not receiving triggers**:

- Check that dev environment is deployed
- Verify Pusher credentials are correct
- Ensure CLI is authenticated with valid API key

## Future Directions

Based on the `.exploration` and `.agents` directories, planned improvements include:

1. **Complete lightyear deprecation** - Fully migrate all functionality to SDK
2. **Enhanced type safety** - More comprehensive type inference
3. **WebSocket/GraphQL support** - Additional connector types
4. **Improved error handling** - More detailed error messages and recovery
5. **Testing utilities** - Built-in testing framework for integrations
6. **Performance optimizations** - Faster sync operations, better batching
7. **Plugin system** - Allow third-party extensions

## Contributing

When adding new features to the SDK:

1. Follow the builder pattern for user-facing APIs
2. Use the registry for component tracking
3. Add handler operations for CLI integration
4. Include comprehensive TypeScript types
5. Write examples in `examples/` directory
6. Update this documentation
7. Reference lightyear package for compatibility guidance

## Conclusion

Lightyear provides a comprehensive platform for building type-safe API integrations. The SDK package is the modern, actively-developed interface, while the lightyear package serves as a reference for existing patterns. The CLI provides seamless development experience with local execution and automatic deployment.

Key principles:

- **Builder pattern** for intuitive API design
- **Type safety** for confidence and developer experience
- **Registry pattern** for component discovery
- **Handler system** for unified execution
- **Platform integration** for serverless deployment

By understanding these core concepts, you can effectively navigate and extend the Lightyear integration platform.
