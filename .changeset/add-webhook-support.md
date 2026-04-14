---
"@unscrambled/sdk": minor
---

Add webhook builder and action trigger support

- New `WebhookBuilder` and `defineWebhook` for creating deployable webhooks with apps, custom apps, variables, and secrets
- Add webhook support to `IntegrationBuilder` via `withWebhook`, `withWebhooks`, `addWebhook`, and `addWebhooks` methods
- Add action trigger support: `withWebhookTrigger` and `withPollingTrigger` on `ActionBuilder`
- Add app/custom app association to actions via `withApp`, `withApps`, `addApp`, `addApps`, `withCustomApp`, `withCustomApps`, `addCustomApp`, and `addCustomApps`
- New `Webhook`, `ActionTrigger` types
- Registry and deploy handler now support webhook components
