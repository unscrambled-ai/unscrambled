# Proposal: Add exports Field to All Packages

**Priority:** Medium  
**Status:** Proposed  
**Packages Affected:** sdk, hubspot, salesforce, cli

## Problem

Only `lightyear` has the modern `exports` field:

```json
// lightyear/package.json (has it)
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist/index.js"
  }
}

// sdk/package.json (missing)
"main": "dist/index.js",
"module": "dist/index.js",
"typings": "dist/index.d.ts"
// No exports field
```

### Why This Matters

1. **ESM/CJS dual support** - `exports` is the modern way to specify both
2. **TypeScript resolution** - Newer `moduleResolution` modes prefer `exports`
3. **Subpath exports** - Enables `@unscrambled/sdk/testing` patterns
4. **Encapsulation** - Prevents importing internal files

## Solution

Add `exports` field to all packages and configure tsup for dual format output.

### Package.json Changes

```json
// packages/@unscrambled/sdk/package.json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "files": ["dist"]
}
```

Same pattern for hubspot, salesforce.

### tsup Configuration

Create `tsup.config.ts` in each package:

```typescript
// packages/@unscrambled/sdk/tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs',
    };
  },
});
```

Update build script:

```json
{
  "scripts": {
    "build": "tsup"
  }
}
```

### Future: Subpath Exports

Once established, can add subpath exports:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./testing": {
      "types": "./dist/testing.d.ts",
      "import": "./dist/testing.mjs",
      "require": "./dist/testing.cjs"
    }
  }
}
```

Enables:
```typescript
import { mockConnector } from '@unscrambled/sdk/testing';
```

## Benefits

1. **Better tooling support** - Bundlers and TypeScript resolve correctly
2. **Dual format** - Works in both ESM and CJS environments
3. **Future-proof** - Aligns with Node.js module evolution
4. **Subpath potential** - Enables logical code organization

## Migration

1. Add tsup.config.ts to each package
2. Update build scripts
3. Add exports field to package.json
4. Keep main/module/types for backward compatibility
5. Test in both ESM and CJS consumer projects
