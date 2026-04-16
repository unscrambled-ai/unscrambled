---
"@unscrambled/cli": patch
"@unscrambled/sdk": patch
---

Improve CLI deploy and dev workflow reliability, and make SDK deploy failures easier to diagnose.

For `@unscrambled/cli`, this updates project creation to use the current starter repository, ensures `dev` builds before the initial deploy, clarifies the duplicate dev server error message, and removes duplicate deploy failure output.

For `@unscrambled/sdk`, this includes deploy API request IDs in retry logs and error messages to make troubleshooting easier, and marks the legacy custom app builder helpers as deprecated in favor of `defineCustomApp`.
