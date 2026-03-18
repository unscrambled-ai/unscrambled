# Proposal: Standardize Workspace Protocol

**Priority:** High  
**Status:** Proposed  
**Packages Affected:** hubspot, salesforce

## Problem

Internal dependency declarations are inconsistent:

```json
// hubspot/package.json
"dependencies": {
  "@runlightyear/sdk": "*",
  "@runlightyear/lightyear": "*"
}

// salesforce/package.json
"dependencies": {
  "@runlightyear/sdk": "workspace:*",
  "@runlightyear/lightyear": "workspace:*"
}
```

### Issues with `"*"`

- Could resolve to published npm version instead of local workspace
- When published, remains as `"*"` - users get "any version"
- No clear compatibility signal

### Issues with `"workspace:*"`

- Better than `"*"` but publishes as `"*"` (any version)
- No semver range constraint

## Solution

Standardize on `workspace:^` for all internal dependencies.

### How `workspace:^` Works

| In workspace | When published |
|--------------|----------------|
| `"workspace:^"` | `"^0.1.0"` (actual version with caret) |
| `"workspace:~"` | `"~0.1.0"` (actual version with tilde) |
| `"workspace:*"` | `"*"` (any version) |

### Changes

```json
// packages/@runlightyear/hubspot/package.json
{
  "dependencies": {
    "@runlightyear/lightyear": "workspace:^"
  },
  "peerDependencies": {
    "@runlightyear/sdk": "^0.1.0"
  },
  "devDependencies": {
    "@runlightyear/sdk": "workspace:^"
  }
}
```

```json
// packages/@runlightyear/salesforce/package.json
{
  "dependencies": {
    "@runlightyear/lightyear": "workspace:^"
  },
  "peerDependencies": {
    "@runlightyear/sdk": "^0.1.0"
  },
  "devDependencies": {
    "@runlightyear/sdk": "workspace:^"
  }
}
```

## Benefits

1. **During development**: Always uses local workspace version
2. **When published**: Becomes proper semver range (e.g., `^0.1.0`)
3. **For users**: Clear compatibility signal, proper version resolution
4. **For npm/pnpm**: Can dedupe correctly based on semver

## Note on lightyear Dependency

Once `lightyear` is fully deprecated and connectors no longer need it:

```json
// Remove entirely
"dependencies": {
  // "@runlightyear/lightyear": "workspace:^"  // Remove this
}
```

Until then, keep it as a regular dependency since it contains runtime code still used by connectors.
