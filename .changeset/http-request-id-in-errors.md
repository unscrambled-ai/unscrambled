---
"@unscrambled/sdk": patch
---

Include request ID in HTTP error messages for easier debugging

`HttpProxyResponseError` now extracts and surfaces request IDs from common response headers (`x-request-id`, `x-amzn-requestid`, `x-amz-request-id`, `x-correlation-id`, `x-vercel-id`) and appends them to error messages and log lines.
