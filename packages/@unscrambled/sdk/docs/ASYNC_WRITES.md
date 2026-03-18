# Async Writes

The SDK now supports asynchronous HTTP writes during sync operations, which can significantly improve performance for syncs that make many HTTP requests.

## Overview

When async writes are enabled (which is the default), batch operations (create, update, delete) will:
1. Send HTTP requests asynchronously without waiting for responses
2. Poll periodically for unconfirmed changes
3. Extract `externalId` and `externalUpdatedAt` from responses
4. Confirm changes in batches

This allows the sync to continue processing while HTTP requests are in flight, resulting in faster sync times.

## Usage

### Default Behavior (Async Writes Enabled)

```typescript
const syncConnector = createSyncConnector(restConnector, collection)
  .withModelConnector("contacts", (builder) =>
    builder
      .withList(/* ... */)
      .withBatchCreate(/* ... */)
  )
  .build();

// Async writes are enabled by default
await syncConnector.sync();
```

### Disabling Async Writes

You can disable async writes in several ways:

#### 1. Via Builder Method

```typescript
const syncConnector = createSyncConnector(restConnector, collection)
  .withModelConnector("contacts", (builder) => /* ... */)
  .withSyncWrites() // Use synchronous writes
  .build();
```

Or explicitly:

```typescript
const syncConnector = createSyncConnector(restConnector, collection)
  .withModelConnector("contacts", (builder) => /* ... */)
  .withAsyncWrites(false) // Explicitly disable
  .build();
```

#### 2. Via Options Parameter

```typescript
// Override at runtime
await syncConnector.sync("FULL", { useAsyncWrites: false });
```

#### 3. Via Environment Variable

```bash
# Disable async writes globally
export LIGHTYEAR_ASYNC_WRITES=false
# or
export LIGHTYEAR_ASYNC_WRITES=0
```

## Configuration Priority

The SDK determines whether to use async writes based on the following priority:

1. **Options parameter** - Highest priority, overrides all other settings
2. **Instance configuration** - Set via builder methods
3. **Environment variable** - Can force disable globally

## How It Works

### Synchronous Mode (Legacy)
```
1. Retrieve delta → 2. Make HTTP request → 3. Wait for response → 4. Confirm change → 5. Repeat
```

### Asynchronous Mode (Default)

The SDK intelligently chooses the optimal async approach based on your connector configuration:

#### When you have batch operations (`withBatchCreate`, `withBatchUpdate`, `withBatchDelete`):
- Uses the regular `/http-request` endpoint with `async: true`
- The API already supports batching, so one request handles multiple items
- Example: `POST /api/contacts/batch` with 100 contacts in the body

```
1. Retrieve delta (e.g., 100 CREATE changes)
2. Send single async request to batch endpoint with all items
3. Continue processing while request is in flight
4. Poll for response and extract results for all items
```

#### When you only have individual operations (`withCreate`, `withUpdate`, `withDelete`):
- Uses the `/http-request/batch` endpoint to parallelize requests
- Simulates batch behavior by sending many individual requests in parallel
- Example: 100 parallel `POST /api/contacts` requests

```
1. Retrieve delta (e.g., 100 CREATE changes)
2. Send 100 individual requests in parallel via batch endpoint
3. Continue processing while requests are in flight
4. Poll for responses and confirm each individually
```

## Performance Considerations

- **Async mode** is ideal for:
  - Syncs with many HTTP operations
  - APIs with higher latency
  - Batch operations

- **Sync mode** may be preferred for:
  - Small data sets
  - When you need immediate confirmation
  - Debugging purposes

## Extract Functions

**IMPORTANT**: When using async writes with batch operations, you MUST provide an extract function that properly maps changeIds to results. The extract function is responsible for returning an array of `BatchConfirmation` objects that include the changeId for each item.

```typescript
.withBatchCreate({
  request: (changes) => ({
    endpoint: "/api/contacts/batch",
    method: "POST",
    json: changes
  }),
  extract: (response) => {
    // The extract function must return an array of BatchConfirmation objects
    // that map each changeId to its corresponding externalId
    return response.results.map((item, index) => ({
      changeId: changes[index].changeId,  // Map to the original changeId
      externalId: item.id,
      externalUpdatedAt: item.updated_at
    }));
  }
})
```

The extract function receives:
- `response`: The full HTTP response from the batch API
- Access to the original `changes` array in the closure

It must return an array of objects with:
- `changeId`: The original changeId from the request
- `externalId`: The ID assigned by the external system
- `externalUpdatedAt`: The timestamp from the external system (optional)

Without a properly implemented extract function that includes changeId mapping, the SDK cannot match batch response items back to individual changes, resulting in "Could not extract externalId" errors.

## Error Handling

In async mode:
- Failed requests are logged but don't stop the sync
- The sync will wait for all pending operations before completing
- Failed changes are tracked but not retried automatically

## Monitoring

You can monitor async writes progress through logs:

```
Using async writes for batch operations
Processing 100 CREATE changes for model contacts (async batch)
Sent 100 async CREATE requests for model contacts
Processing 25 unconfirmed changes for sync abc123
Confirmed 25 changes for sync abc123
Waiting for pending async operations to complete...
```