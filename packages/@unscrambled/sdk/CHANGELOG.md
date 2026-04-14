# @unscrambled/sdk

## 0.3.0

### Minor Changes

- 7145395: Add webhook builder and action trigger support

  - New `WebhookBuilder` and `defineWebhook` for creating deployable webhooks with apps, custom apps, variables, and secrets
  - Add webhook support to `IntegrationBuilder` via `withWebhook`, `withWebhooks`, `addWebhook`, and `addWebhooks` methods
  - Add action trigger support: `withWebhookTrigger` and `withPollingTrigger` on `ActionBuilder`
  - Add app/custom app association to actions via `withApp`, `withApps`, `addApp`, `addApps`, `withCustomApp`, `withCustomApps`, `addCustomApp`, and `addCustomApps`
  - New `Webhook`, `ActionTrigger` types
  - Registry and deploy handler now support webhook components

### Patch Changes

- 7145395: Include request ID in HTTP error messages for easier debugging

  `HttpProxyResponseError` now extracts and surfaces request IDs from common response headers (`x-request-id`, `x-amzn-requestid`, `x-amz-request-id`, `x-correlation-id`, `x-vercel-id`) and appends them to error messages and log lines.

## 0.2.0

### Minor Changes

- Rebrand from @runlightyear to @unscrambled

  - Renamed package to @unscrambled/sdk
  - Platform URLs updated to unscrambled.ai
  - Environment variables renamed: LIGHTYEAR_API_KEY -> UNSCRAMBLED_API_KEY, LIGHTYEAR_ENV -> UNSCRAMBLED_ENV
