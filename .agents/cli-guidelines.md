# CLI Guidelines

This document captures guidelines for creating and maintaining the `@unscrambled/cli` so it works well for both humans and agents.

## Goal

The CLI should be:

- easy to discover incrementally
- safe by default
- non-interactive by default
- predictable across commands
- scriptable in pipelines
- explicit in both success and failure cases

Humans can infer intent from incomplete prompts and ambiguous output. Agents cannot. The CLI should make the correct invocation obvious from the command shape, help output, examples, exit codes, and returned data.

## Core Principles

### 1. Prefer non-interactive execution

Every required input should be passable as a flag or via stdin. Interactive prompts are a fallback when flags are omitted, not the primary interface.

Bad:

```bash
unscrambled deploy
# prompts for environment, confirmation, or tag
```

Good:

```bash
unscrambled deploy prod --tag v1.2.3 --yes
```

If interactive mode exists, it should be explicit, for example:

```bash
unscrambled trigger --interactive
```

### 2. Make `--help` locally useful

Every command and subcommand should provide enough help for an agent to use that command without reading broader documentation first.

Each `--help` should include:

- what the command does
- required arguments and flags
- defaults and accepted values
- destructive or slow behavior when relevant
- at least 2-3 concrete examples

Examples do most of the work. Agents pattern-match from examples faster than they infer from prose.

### 3. Support progressive discovery

Do not front-load documentation for the entire CLI into top-level help output. An agent should be able to:

1. run `unscrambled --help`
2. pick a subcommand
3. run `unscrambled <subcommand> --help`
4. get enough information to proceed

Top-level help should stay concise and point users toward the next discovery step.

### 4. Accept flags and stdin for machine workflows

Agents think in pipelines. Commands should compose cleanly.

Good patterns:

```bash
cat payload.json | unscrambled auth connect hubspot --stdin
unscrambled build --output tag-only
unscrambled deploy prod --tag "$(unscrambled build --output tag-only)"
```

Prefer flags, `--stdin`, and structured output modes over positional argument tricks or hidden prompts.

### 5. Fail fast with actionable errors

If required input is missing or invalid, exit immediately with a clear message and the next correct invocation.

Good error shape:

```text
Error: Missing required option `--tag`.
Try:
  unscrambled deploy prod --tag <image-tag>
```

Better still:

```text
Error: Missing required option `--tag`.
Try:
  unscrambled deploy prod --tag <image-tag>
Related:
  unscrambled build --output tag-only
```

Do not silently fall back to prompts when the user is clearly in a non-interactive flow.

### 6. Make commands idempotent where possible

Agents retry. Commands should tolerate repeated execution without duplicating work or creating confusing side effects.

Examples:

- reconnecting an already connected auth should report current state
- deploying the same artifact twice should no-op when nothing changed
- deleting an already-removed resource should clearly state that it is absent

When an operation cannot be idempotent, say so explicitly in help and errors.

### 7. Provide `--dry-run` for destructive or expensive actions

Any command that mutates remote state, deletes data, or triggers costly work should offer a preview mode where feasible.

Good:

```bash
unscrambled collections clear customers --dry-run
```

The dry run should describe:

- what would change
- which resources are affected
- whether any follow-up confirmation would still be needed

### 8. Support explicit confirmation bypass

Dangerous commands should be safe by default, but they must allow agents to bypass confirmation with a flag such as `--yes` or `--force`.

Use this pattern consistently:

- `--yes` for skipping human confirmation
- `--force` only when behavior changes beyond confirmation, such as overriding safeguards

Avoid inventing multiple confirmation flags for similar actions.

### 9. Keep command structure predictable

Use a consistent naming scheme across the CLI. If a user learns one resource group, they should be able to guess others.

Prefer a consistent pattern such as:

- `<resource> list`
- `<resource> get <id>`
- `<resource> watch <id>`
- `<resource> cancel <id>`

Choose one style and reuse it. Avoid having one area use `deploy list`, another use `list deploys`, and another use `show-deploys`.

### 10. Return useful data on success

Success output should include identifiers and follow-up handles, not just celebratory text.

Prefer:

```text
deployed v1.2.3 to staging
url: https://staging.example.com
deploy_id: dep_abc123
duration: 34s
```

Not:

```text
Success!
```

For commands that create or trigger work, include the IDs needed to inspect or continue that workflow.

## Additional Agent-Friendly Guidelines

### 11. Offer structured output

Any command that returns data should support a machine-readable mode such as `--json`.

Guidance:

- use human-readable output by default
- offer `--json` for scripting and agent workflows
- keep JSON stable and documented
- print data to stdout
- print logs, warnings, and progress to stderr where possible

This prevents logs from corrupting piped JSON.

### 12. Keep output deterministic

Avoid output that changes shape unpredictably between runs.

Prefer:

- stable field names
- stable ordering for table columns and JSON keys where practical
- timestamps only when useful
- no random phrasing in success or error messages

Agents rely on repeated patterns to recover from partial failures.

### 13. Use clear exit behavior

Exit codes should reflect command outcome consistently.

Guidance:

- `0` for success
- non-zero for failure
- distinguish usage errors from runtime failures when practical
- do not swallow errors and still exit `0`

If a command partially succeeds, say exactly what succeeded and what failed.

### 14. Separate progress from final results

Long-running commands should make it obvious whether they are:

- still running
- waiting on remote work
- complete
- failed

If the command waits on async server work, consider:

- returning a resource ID immediately
- offering a separate `watch` or `wait` command
- making waiting behavior explicit via flags

Do not leave the user guessing whether the CLI is hung.

### 15. Avoid hidden state and surprising defaults

Agents struggle when behavior depends on invisible local state.

Prefer explicitness around:

- current environment
- current project
- current auth/account
- default output mode
- config file paths

When defaults are used, say which defaults were applied.

### 16. Support environment-variable configuration

If a value is commonly supplied in CI or automation, allow it through environment variables in addition to flags.

Examples:

- auth tokens
- API hosts
- output mode defaults
- non-interactive confirmation defaults

Document precedence clearly: explicit flag, then env var, then config, then interactive fallback.

### 17. Preserve backwards compatibility in command shape

Agents often encode a working invocation and reuse it later. Avoid unnecessary churn in:

- command names
- flag names
- output field names
- exit semantics

If a change is required:

- keep aliases for a deprecation window
- emit a clear deprecation warning
- update examples everywhere

### 18. Keep examples copy-pasteable

Examples in help text and docs should run as written.

Prefer:

- realistic resource names
- complete invocations
- examples that show common combinations of flags

Avoid placeholder-heavy examples that require too much interpretation.

## Guidance For This Repo

The current CLI already has a number of command groups such as `syncs`, `collections`, `objects`, `runs`, `actions`, `auth`, and `envs`. New commands should extend that structure rather than inventing one-off patterns.

When maintaining `@unscrambled/cli`:

- use `Commander` consistently for command structure and help output
- keep interactive behavior opt-in or fallback-only
- prefer `program.error()` for user-facing failures rather than hanging or exiting silently
- use the shared terminal output utilities for human-facing output
- keep command naming aligned with existing resource-oriented groups

## Command Design Checklist

When adding or changing a command, verify:

- can every required input be passed non-interactively?
- does `--help` include examples?
- is there a `--json` mode if the command returns data?
- does destructive behavior support `--dry-run` and `--yes` where appropriate?
- are success outputs returning IDs, URLs, or next-step handles?
- are error messages actionable and immediately recoverable from?
- is the command safe to retry?
- does the command fit existing naming patterns?
- is long-running behavior explicit?
- are stdout and stderr separated appropriately?

## Preferred Patterns

Prefer:

- explicit flags over prompts
- subcommand-local help over large global docs
- examples over abstract descriptions
- stable JSON for automation
- clear IDs and URLs in success output
- idempotent operations
- explicit confirmation bypass for destructive actions

Avoid:

- blocking prompts in default flows
- help output with no examples
- commands that only work for humans watching a terminal
- success messages with no returned identifiers
- destructive actions with no preview mode
- inconsistent verb ordering across resources
- mixed logs and JSON in stdout
