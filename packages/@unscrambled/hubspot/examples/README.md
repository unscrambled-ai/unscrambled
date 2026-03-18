# HubSpot Package Examples

This directory contains examples of how to use the `@unscrambled/hubspot` package with the new SDK.

## Examples

### 1. Basic Usage (`basic-usage.ts`)
Shows the standard setup for using HubSpot with OAuth authentication and basic CRM operations:
- Setting up OAuth connector
- Creating a custom app
- Using the REST connector for API calls
- Setting up sync connector with standard CRM models
- Creating actions for syncing and CRUD operations

### 2. Custom Collection (`custom-collection.ts`)
Demonstrates how to:
- Create a minimal custom collection with only specific models
- Use the standard CRM collection with selected models
- Work with a subset of available models

### 3. Extended Models (`extended-models.ts`)
Shows advanced usage including:
- Adding custom model connectors (e.g., products)
- Overriding existing model connectors with custom logic
- Implementing full CRUD operations for custom models
- Customizing pagination and field selection

### 4. Custom App Configuration (`custom-app-config.ts`)
Covers various authentication and configuration scenarios:
- Using custom OAuth scopes
- Configuring for different regions (EU vs US)
- API key authentication
- Adding custom variables and secrets
- Conditional logic based on configuration

## Key Concepts

### Flexibility
The HubSpot package provides building blocks that you can compose:
- `defineHubSpotCustomApp()` - Returns a custom app builder preconfigured with:
  - App name: "hubspot"
  - Auth type: "OAUTH2"
  - Title: "HubSpot"
  - OAuth connector with standard HubSpot scopes
  - Required `appId` variable
- `createHubSpotOAuthConnector()` - Returns an OAuth connector with HubSpot defaults (used by `defineHubSpotCustomApp`)
- `createHubSpotRestConnector()` - Returns a REST connector configured for HubSpot's API
- `createHubSpotSyncConnector()` - Returns a sync connector builder with HubSpot model connectors

### Extensibility
You can:
- Use any collection (custom or standard CRM)
- Add new model connectors
- Override existing model connectors
- Customize any part of the configuration

### Model Support
Out of the box, the package provides connectors for:
- `user` (HubSpot owners)
- `account` (HubSpot companies)
- `contact`
- `opportunity` (HubSpot deals)
- `task`
- `meeting`
- `note`
- `call`

You can add support for additional HubSpot objects like products, line items, tickets, etc.