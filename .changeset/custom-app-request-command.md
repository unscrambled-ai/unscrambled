---
"@unscrambled/cli": minor
---

Add an `unscrambled custom-app request` command for authorized custom app API requests

- Added `unscrambled custom-app request <customAppName>` to make authenticated requests through custom app connections
- Supports `--url` for full request URLs or `--base-url` plus `--path` for a more app-like request shape
- Supports optional `--auth <authName>` when a custom app has multiple auth connections
- Requires callers to provide explicit custom-app auth header templates such as `Bearer {{ accessToken }}`, `{{ apiKey }}`, or `{{basicAuth username password}}`
- Reuses the existing platform `http-request` endpoint and surfaces the returned `X-Http-Request-Id`
