# Proposal: Consider Linked Versioning During 0.x

**Priority:** Low  
**Status:** Proposed  
**Affects:** Changesets configuration

## Problem

Current version state shows potential confusion:

| Package | Version |
|---------|---------|
| sdk | 0.1.0 |
| hubspot | 1.1.0 |
| salesforce | 0.10.2 |
| lightyear | 2.3.2 |
| cli | 1.7.3 |

Users seeing `hubspot@1.1.0` depending on `sdk@0.1.0` might wonder about stability.

Current changesets config:

```json
{
  "updateInternalDependencies": "patch",
  "linked": [],
  "fixed": []
}
```

This means:
- Packages version independently
- When sdk updates, dependents get a patch bump (if they depend on the new version)

## Options

### Option A: Keep Independent Versioning (Current)

**Pros:**
- Each package has its own release cadence
- Connector can be at 1.x while SDK is at 0.x
- More flexibility

**Cons:**
- Version numbers don't signal compatibility
- User confusion about which versions work together

**Keep if:** You want maximum flexibility and will document compatibility separately.

### Option B: Linked Versioning

```json
{
  "linked": [
    ["@runlightyear/sdk", "@runlightyear/hubspot", "@runlightyear/salesforce"]
  ]
}
```

**How it works:**
- When any linked package gets a version bump type (major/minor/patch), all get the same bump
- Packages don't have to be the same version, but they move together
- e.g., sdk 0.1.0 → 0.2.0 causes hubspot 1.1.0 → 1.2.0

**Pros:**
- Clear "these versions were released together" signal
- Easier compatibility reasoning

**Cons:**
- Connector bug fix bumps SDK version unnecessarily

### Option C: Fixed Versioning (Lockstep)

```json
{
  "fixed": [
    ["@runlightyear/sdk", "@runlightyear/hubspot", "@runlightyear/salesforce"]
  ]
}
```

**How it works:**
- All packages in the group have the exact same version
- sdk 0.5.0 = hubspot 0.5.0 = salesforce 0.5.0

**Pros:**
- Crystal clear compatibility
- Simple mental model

**Cons:**
- All packages must be versioned together
- Can't release connector fix without SDK version bump

## Recommendation

**During 0.x development:** Consider **Option B (Linked)** for sdk + connectors.

This signals "these packages are tightly coupled and evolving together" while still allowing independent patch releases.

**After SDK 1.0:** Switch back to **Option A (Independent)** with proper semver ranges. At that point, the SDK is stable and connectors can version independently with clear `peerDependencies` ranges.

## If Implementing Linked Versioning

```json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@2.2.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [
    ["@runlightyear/sdk", "@runlightyear/hubspot", "@runlightyear/salesforce"]
  ],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "minor",
  "ignore": ["@runlightyear/lightyear"]
}
```

Note: `lightyear` is excluded since it's deprecated and should version independently.

## Alternative: Do Nothing

The current setup is valid. The version mismatch is cosmetic and can be addressed through documentation:

> "Use the latest versions of all @runlightyear packages together for best compatibility."

This is a low-priority improvement.
