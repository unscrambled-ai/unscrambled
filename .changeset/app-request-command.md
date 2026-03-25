---
"@unscrambled/cli": minor
---

Add an `unscrambled app request` command for connector-backed app API requests

- Added `unscrambled app request <appName>` to make authenticated app requests without manually constructing auth headers
- Sends app-aware requests through the existing platform `http-request` endpoint using `appName`, relative `path`, method, query params, headers, and optional body
- Supports repeatable `--query key=value` and `--header "Name: value"` flags plus `--json` or `--body` payloads
- Surfaces the platform `X-Http-Request-Id` in CLI output for easier request inspection and debugging
