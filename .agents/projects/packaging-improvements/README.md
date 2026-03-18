# Packaging Improvements

This directory contains proposals for improving how Lightyear packages are published and distributed.

## Goals

- Optimize for developer experience (easy to use, extend, or rewrite)
- Ensure AI-friendly code generation (types align, imports work naturally)
- Minimize bundle sizes and avoid duplicate dependencies
- Maintain clear version compatibility signals
- Support 100s of connectors efficiently at scale

## Proposals

| File | Priority | Status | Description |
|------|----------|--------|-------------|
| [01-zod-peer-dependency.md](./01-zod-peer-dependency.md) | High | Proposed | Move Zod to peerDependencies |
| [02-workspace-protocol.md](./02-workspace-protocol.md) | High | Proposed | Standardize on `workspace:^` |
| [03-exports-field.md](./03-exports-field.md) | Medium | Proposed | Add exports field to all packages |
| [04-linked-versioning.md](./04-linked-versioning.md) | Low | Proposed | Consider linked versioning during 0.x |

## Current State Analysis

### Package Dependencies

```
@runlightyear/sdk (0.1.0)
    └── zod: ^4.0.17 (dependency)

@runlightyear/hubspot (1.1.0)
    ├── @runlightyear/sdk: "*" (dependency)
    ├── @runlightyear/lightyear: "*" (dependency)
    └── zod: ^4.0.17 (dependency)

@runlightyear/salesforce (0.10.2)
    ├── @runlightyear/sdk: "workspace:*" (dependency)
    ├── @runlightyear/lightyear: "workspace:*" (dependency)
    └── zod: ^4.0.17 (dependency)

@runlightyear/lightyear (2.3.2) [DEPRECATED]
    └── zod: ^3.22.4 (dependency)
```

### Distribution Model (Current - Correct)

- Packages are built with `tsup`
- Dependencies are **externalized** (not bundled) - this is correct
- Each package ships only its own code
- SDK/Zod resolved at install time from node_modules

Verified:
```javascript
// hubspot/dist/index.js
var import_sdk = require("@runlightyear/sdk");  // External, not bundled
var import_zod = require("zod");                 // External, not bundled
```

Bundle sizes confirm no bundling:
- hubspot: 1,103 lines
- sdk: 8,363 lines (if bundled, hubspot would be much larger)

### Issues Identified

1. **Zod in dependencies** - Can cause duplicate installations, type mismatches
2. **Inconsistent workspace protocol** - `"*"` vs `"workspace:*"`
3. **Missing exports field** - Only lightyear has it
4. **Version mismatch** - lightyear uses Zod v3, others use v4
5. **Deprecated lightyear still referenced** - Connectors still depend on it

---

## Target Architecture

### Package Structure

```
lightyear/
├── packages/@runlightyear/
│   ├── sdk/                    # @runlightyear/sdk (core)
│   ├── cli/                    # @runlightyear/cli
│   ├── hubspot/                # @runlightyear/hubspot
│   ├── salesforce/             # @runlightyear/salesforce
│   └── .../                    # More connectors
├── apps/
│   └── docs/                   # Documentation site
├── packages/util/              # Shared configs
├── turbo.json                  # Turborepo config
├── pnpm-workspace.yaml         # pnpm workspaces
└── .changeset/                 # Changesets config
```

### Target Dependency Model

SDK as peerDependency in connectors:

```json
// packages/@runlightyear/hubspot/package.json
{
  "name": "@runlightyear/hubspot",
  "peerDependencies": {
    "@runlightyear/sdk": "^0.1.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@runlightyear/sdk": "workspace:^",
    "zod": "^4.0.17"
  }
}
```

### Dual ESM/CJS Builds with Tree-Shaking

```json
{
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts"
}
```

tsup config:
```typescript
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.cjs' };
  },
});
```

---

## Tooling Decision: Turborepo vs Nx

**Current choice: Turborepo + pnpm** - This is appropriate for the current scale.

| Aspect | Turborepo + pnpm | Nx |
|--------|------------------|-----|
| Complexity | Simple (~40 line config) | Heavy (many files) |
| Learning curve | Minimal | Significant |
| Build caching | Excellent | Excellent |
| Open source friendly | Easy to fork/understand | Harder for contributors |
| Affected detection | Basic | Advanced (code-aware) |
| Generators | None built-in | Excellent |

**Recommendation:** Stay with Turborepo until you have 50+ connectors. The simplicity benefits outweigh Nx's advanced features at current scale. Revisit when scaling pain points emerge.

---

## Versioning Strategy

### SDK Follows Strict Semver

| SDK Change | Version Bump | Connector Impact |
|------------|--------------|------------------|
| Bug fix | `1.0.0` → `1.0.1` | None (satisfies `^1.0.0`) |
| New feature | `1.0.1` → `1.1.0` | None (satisfies `^1.0.0`) |
| Breaking change | `1.1.0` → `2.0.0` | Must update peer dep |

### When Connectors Need Version Bumps

| Scenario | Connector needs new version? |
|----------|------------------------------|
| SDK patch/minor (non-breaking) | **No** |
| SDK major (breaking) | **Yes** - update peer dep range |
| Connector's own code changes | **Yes** |
| Connector needs new SDK feature | **Yes** - bump minimum: `^1.2.0` |

### Current Changesets Config

```json
{
  "updateInternalDependencies": "patch",
  "linked": [],
  "fixed": []
}
```

This means packages version independently. Consider `linked` during 0.x for clearer compatibility signals - see [04-linked-versioning.md](./04-linked-versioning.md).

---

## Implementation Priority

1. **High: Zod as peerDependency** - Biggest DX/type safety win
2. **High: Standardize workspace:^** - Proper semver when published
3. **Medium: Add exports field** - Better tooling support
4. **Low: Linked versioning** - Optional, cosmetic improvement
