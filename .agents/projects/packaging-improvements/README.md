# Packaging Improvements

## Goals

- Optimize bundle size for Lambda deployments
- Support 100s of connectors efficiently
- Enable independent connector releases (only version bump when connector code changes)
- Improve build performance with smart caching and affected detection

## Current State Issues

### 1. SDK as Regular Dependency

Currently in connector `package.json`:
```json
"dependencies": {
  "@runlightyear/lightyear": "workspace:*",
  "@runlightyear/sdk": "workspace:*",
  "zod": "^4.0.17"
}
```

**Problem:** Each connector bundles its own copy of SDK. If a user installs 5 connectors, they get 5 copies of the SDK in their Lambda.

### 2. Deprecated `lightyear` Package Still Referenced

The `@runlightyear/lightyear` package is deprecated but still listed as a dependency in connectors and the connector template.

### 3. Stale Connector Template

`connector-template/` references:
- `@runlightyear/lightyear` (deprecated)
- TypeScript 4.5 (current is 5.8)
- ESLint 7 (current is 9)
- Node types 12 (current is 20)

### 4. No Tree-Shaking Support

Missing `sideEffects: false` and dual ESM/CJS builds.

## Target Architecture

```
lightyear/
├── packages/
│   ├── sdk/                    # @runlightyear/sdk (core)
│   ├── cli/                    # @runlightyear/cli
│   └── connectors/
│       ├── salesforce/         # @runlightyear/salesforce
│       ├── hubspot/            # @runlightyear/hubspot
│       └── .../                # 100s more
├── tools/
│   └── generators/             # Nx generators for scaffolding
├── nx.json                     # Nx configuration
├── pnpm-workspace.yaml         # pnpm workspaces
└── .changeset/                 # Changesets config
```

### SDK as peerDependency

Connector `package.json`:
```json
{
  "name": "@runlightyear/salesforce",
  "version": "1.0.0",
  "peerDependencies": {
    "@runlightyear/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@runlightyear/sdk": "workspace:*"
  }
}
```

### Dual ESM/CJS Builds with Tree-Shaking

```json
{
  "sideEffects": false,
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  }
}
```

tsup config:
```js
export default {
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  clean: true,
}
```

## Migration: Turborepo to Nx

### Rationale

| Feature | Turborepo (current) | Nx |
|---------|--------------------|----|
| Affected detection | Basic | Advanced (understands code deps) |
| Project graph | File-based | Code-aware (analyzes imports) |
| Generators/scaffolding | None built-in | Excellent (`nx generate`) |
| Remote cache | Vercel only (paid) | Nx Cloud (free tier) or self-host |
| Distributed execution | Vercel (paid) | Nx Agents (free tier available) |

At 100s of connectors, Nx's `nx affected` command is critical - only builds/tests/publishes packages affected by changes.

### Migration Steps

1. Run `npx nx init` to import existing workspace
2. Configure `nx.json` with build targets
3. Set up Nx Cloud for remote caching (`nx connect`)
4. Update CI to use `nx affected` commands

## Versioning Strategy

### SDK Follows Strict Semver

| SDK Change | Version Bump | Connector Impact |
|------------|--------------|------------------|
| Bug fix | `1.0.0` → `1.0.1` | None |
| New feature (backward compatible) | `1.0.1` → `1.1.0` | None |
| Breaking change | `1.1.0` → `2.0.0` | Must update peer dep |

### When Connectors Need Version Bumps

| Scenario | Connector needs new version? |
|----------|------------------------------|
| SDK patch/minor (non-breaking) | **No** |
| SDK major (breaking) | **Yes** - update peer dep range |
| Connector's own code changes | **Yes** |
| Connector needs new SDK feature | **Yes** - bump minimum: `^1.2.0` |

### Example at Scale

```
SDK:        1.0.0 → 1.1.0 → 1.2.0 → 1.3.0 → 2.0.0 (breaking)
            ↑                              ↑
Salesforce: 1.0.0 (peer: ^1.0.0) ────→ 2.0.0 (peer: ^2.0.0)
HubSpot:    1.0.0 (peer: ^1.0.0) ────→ 2.0.0 (peer: ^2.0.0)
```

Only 2 connector releases each over the entire SDK 1.x lifecycle.

## Future Considerations

### @runlightyear/connector-base

If patterns emerge across connectors (common OAuth helpers, pagination, rate limiting), extract to a shared package. Wait until 5-10 connectors exist and patterns are clear - premature abstraction is worse than duplication.

### Nx Generators

Create generators for scaffolding new connectors:
```bash
nx generate @runlightyear/tools:connector stripe
```

This ensures consistency across 100s of connectors.
