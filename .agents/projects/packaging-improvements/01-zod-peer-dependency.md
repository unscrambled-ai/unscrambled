# Proposal: Move Zod to peerDependencies

**Priority:** High  
**Status:** Proposed  
**Packages Affected:** sdk, hubspot, salesforce

## Problem

Zod is currently a direct `dependency` in each package:

```json
// sdk/package.json
"dependencies": {
  "zod": "^4.0.17"
}

// hubspot/package.json
"dependencies": {
  "zod": "^4.0.17"
}
```

This causes:

1. **Potential duplicate installations** - npm/pnpm may install multiple Zod copies
2. **Type incompatibility** - `z.string()` from one package isn't the same type as another
3. **User friction** - Developers can't use their preferred Zod version
4. **Larger installs** - Multiple copies increase node_modules size

## Solution

Move Zod to `peerDependencies` in all packages.

### SDK Changes

```json
// packages/@unscrambled/sdk/package.json
{
  "peerDependencies": {
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "zod": "^4.0.17"
  }
}
```

Add convenience re-export:

```typescript
// packages/@unscrambled/sdk/src/index.ts
export { z } from 'zod';
export type { ZodSchema, ZodType, ZodObject, infer as ZodInfer } from 'zod';
```

### Connector Changes

```json
// packages/@unscrambled/hubspot/package.json
{
  "peerDependencies": {
    "@unscrambled/sdk": "^0.1.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@unscrambled/sdk": "workspace:^",
    "zod": "^4.0.17"
  }
}
```

```json
// packages/@unscrambled/salesforce/package.json
{
  "peerDependencies": {
    "@unscrambled/sdk": "^0.1.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@unscrambled/sdk": "workspace:^",
    "zod": "^4.0.17"
  }
}
```

## User Experience

### Before (Current)

```bash
npm install @unscrambled/hubspot
# Installs hubspot + sdk + zod (possibly multiple copies)
```

```typescript
import { z } from 'zod';
import { defineHubSpotCustomApp } from '@unscrambled/hubspot';
// Types may not align if different zod versions
```

### After (Proposed)

```bash
npm install @unscrambled/hubspot zod
# or: npm install @unscrambled/hubspot (warns about missing peer)
```

```typescript
import { z } from 'zod';
// or: import { z } from '@unscrambled/sdk';
import { defineHubSpotCustomApp } from '@unscrambled/hubspot';
// Single zod instance, types always align
```

## Industry Precedent

This pattern is used by:

- **tRPC** - `zod` as peerDependency
- **Drizzle ORM** - `zod` as optional peerDependency
- **React Hook Form** - `zod` as optional peerDependency (via @hookform/resolvers)
- **Prisma** - `zod` as optional peerDependency (via zod-prisma)

## Migration Path

1. Update package.json files (non-breaking for existing installs)
2. Add re-export to SDK
3. Update documentation to show `npm install @unscrambled/sdk zod`
4. Consider adding `peerDependenciesMeta` for better warnings:

```json
{
  "peerDependenciesMeta": {
    "zod": {
      "optional": false
    }
  }
}
```

## Risks

- **Minor friction**: Users must explicitly install zod
- **Version conflicts**: If user has incompatible zod version

Both are acceptable tradeoffs for proper type safety and smaller bundles.
