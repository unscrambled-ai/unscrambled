## Sync Connector: Implementation Requirements

These requirements describe how the `sync` function must behave for a Sync Connector, based on the current implementation in `packages/@unscrambled/lightyear` (notably `connectors/SyncConnector.ts`, `connectors/ModelConnector.ts`, and base utilities in `base/collection.ts`, `base/syncAction.ts`, `base/time.ts`). They are intended for implementing compatible behavior in the AI SDK.

### Scope

- **In-scope**: Orchestrating per-model sync for a collection; pull/push/bidirectional direction handling; progress tracking and resumption; batching; time-limit handling and reruns; API contract with the platform (list/upsert/delta).
- **Out-of-scope**: Defining when a run is triggered; wiring to actions/integrations; auth provisioning; HTTP client internals.

### SDK package differences (what exists today)

- **Builder-pattern connector**: In `packages/@unscrambled/sdk/src/builders/syncConnector.ts`, the SDK exposes a builder that configures per-model operations (`list`, `create`, `update`, `delete`, optional `bulk`). Each operation describes request/response via config, with optional `zod` schema validation and transform functions.
- **Current SyncConnector API**: `SyncConnector.sync()` has no parameters and currently just iterates configured models and performs a single `list()` call when defined, logging the count. It does not yet implement Lightyear’s `syncId`, direction, progress, pull/push loops, pagination loops, or platform interactions.
- **List contract in SDK**: `list(params)` returns `{ items: T[]; nextCursor?: string }`. Pagination can be configured via `pagination` (cursor/page/offset) and a `responseSchema` + `transform` can shape typed `items`.
- **No platform primitives**: The SDK builder does not directly call platform APIs like `getSync`, `updateSync`, `upsertObjectBatch`, `retrieveDelta`, `confirmChange(…)`. These must be integrated by the `sync` orchestrator when running inside the platform context.

## Public API

- **SyncConnector.sync()**

  - Signature: `() => Promise<void>`
  - Orchestrates syncing of all models within a collection. No parameters are required; the connector reads required state (e.g., `syncId`, direction) from context and the platform.

- **ModelConnector.sync()**
  - Signature: `() => Promise<void>`
  - Executes the sync for a specific model: pulls external data into the platform and/or pushes local changes to the external system. No parameters are required; model sync reads state from context and the platform.

Note: The AI SDK intentionally uses a parameterless `sync()` API. The runtime/action wrapper sets context (e.g., `setContext({ syncId })`) before invoking sync. The requested direction is derived from the platform’s sync record and defaults to "bidirectional" when unspecified.

## Preconditions and Context

- `syncId` is created by the platform when the sync run starts (see `base/syncAction.ts` `startSync`). The calling action sets context: `setContext({ syncId })`.
- Auth must be present and must include a managed user:
  - `connector.getAuthData()` must be non-null and `auth.managedUser` must exist. Otherwise, throw an error.
- Direction is obtained from the platform sync record (e.g., a field set for the run). If not specified, default to "bidirectional". Resumption uses `currentDirection` stored in the sync record.

## High-Level Flow

### Collection-level orchestration (SyncConnector)

1. Fetch the model list for the collection from the platform: `getModels({ collectionName })`.
2. Determine `modelsToSync` (ordered by the platform’s model list).
3. Fetch the current sync state: `getSync({ syncId })`.
4. If `sync.currentModel?.name` is present, resume from that model by slicing the list starting at that model name.
5. For each `modelName` in `modelsToSync`:
   - Look up the model connector instance from `this.getModelConnector(modelName)`.
   - If found:
     - `updateSync({ syncId, currentModelName: modelName })`.
     - `await model.sync()`.
     - After the model finishes, clear the direction marker: `updateSync({ syncId, currentDirection: null })`.

### Model-level processing (ModelConnector)

1. Read run context: `const { syncId, managedUserId } = getContext()`; throw if `syncId` is missing.
2. Resolve connector auth and validate presence of a managed user (e.g., `auth.managedUser`).
3. Load sync state: `const sync = await getSync({ syncId })` and derive:
   - `syncType` (`FULL` | `INCREMENTAL`).
   - `cursor` (only if `sync.lastBatch?.modelName === this.modelName`, else `undefined`).
   - `lastExternalId` and `lastExternalUpdatedAt` from `sync.modelStatuses[this.modelName]`.
   - `requestedDirection` from the sync record (default to "bidirectional") and `currentDirection` from sync.
4. Pull phase (only if `requestedDirection` is `pull` or `bidirectional`, and `currentDirection !== "PUSH"`):
   - `updateSync({ syncId, currentDirection: "PULL" })`.
   - Repeat until no more pages/batches:
     - If time limit exceeded (`isTimeLimitExceeded()`), then `pauseSync(syncId)` and `throw RERUN`.
     - Call model `list(...)` and paginate based on SDK list config:
       - Cursor pagination: pass `cursor` in params; continue while `nextCursor` is returned.
       - Page/offset pagination: increment `page` or `offset` until empty page.
     - Include incremental watermarks in params: pass `lastExternalId` and `lastExternalUpdatedAt` to the list `request(params)` so the config can map them to provider-specific query fields.
     - Transform `items` into platform objects `{ externalId, externalUpdatedAt, data }` via the SDK transform function or a model-specific mapper, then call `upsertObjectBatch({ collectionName, syncId, modelName, app, customApp, managedUserId, objects, cursor?, async: true })`.
     - Update `lastExternalId/lastExternalUpdatedAt` from the last item in the processed page.
5. Push phase (only if `requestedDirection` is `push` or `bidirectional`):
   - `updateSync({ syncId, currentDirection: "PUSH" })`.
   - Repeat:
     - If time limit exceeded, `pauseSync(syncId)` and `throw RERUN`.
     - Retrieve next batch of local changes: `retrieveDelta({ collectionName, syncId, modelName })`.
     - If `delta.changes.length === 0`, stop pushing.
     - Dispatch to the appropriate SDK-configured operation:
       - Prefer `bulk.create`/`bulk.update`/`bulk.delete` when available.
       - Else, fall back to `create`/`update`/`delete` in batches.
       - Use `transformRequest` hooks where provided.
     - After a successful external write, acknowledge changes back to the platform using `confirmChangeBatch` (preferred) or `confirmChange`.
     - Continue until the delta is empty.

## ModelConnector Contract (methods to implement)

- **getNoun()**: Returns the model’s singular noun used for logging.
- **list(props: { syncType, lastExternalId?, lastExternalUpdatedAt?, cursor? }) => Promise<{ objects, cursor? }>**
  - Must return an ordered page of external objects mapped to `{ id, updatedAt, isDeleted, data }`.
  - `cursor` signals there is another page; omit or return `undefined`/falsy to stop.
  - Respect `syncType`:
    - `FULL`: Return all objects.
    - `INCREMENTAL`: Return only objects changed since the last watermark (`lastExternalId/lastExternalUpdatedAt`) where applicable.
- **createBatch({ changes }) / updateBatch({ changes }) / deleteBatch({ changes }) => Promise<void>**
  - Apply changes to the external system in batches.
  - On success, you MUST acknowledge each applied change back to the platform using either `confirmChangeBatch({ syncId, changes })` or `confirmChange({ syncId, changeId, externalId, externalUpdatedAt })` to advance the delta window. If you do not confirm, the same changes will be re-delivered.
- **validateListResponse(response) -> ModelListResponse**: Optional runtime validation of external list responses.
- **mapExternalToObject(external) -> { id, updatedAt, isDeleted, data }**: Transform external records to the platform object shape.
- **mapObjectDataToExternalData(data) -> externalData**: Transform platform object data to the external API payload shape.

SDK config-driven shape (preferred in AI SDK):

- `list(params) => Promise<{ items: T[]; nextCursor?: string }>`
  - Implemented via `config.list` with optional `responseSchema` (zod) and `transform(response) => T[]`.
  - The `sync` orchestrator passes `cursor/page/offset/limit` and watermarks (`lastExternalId`, `lastExternalUpdatedAt`) in `params`.
- `create(data)`, `update(id, data)`, `delete(id)` and `bulk.*` are driven by config and should be used by the `sync` orchestrator for push.
- The `sync` orchestrator is responsible for mapping `T` to platform object fields `{ externalId, externalUpdatedAt, data }`. Implementers can:
  - Return `T` where `id` and `updatedAt` exist directly, or
  - Provide a model-specific mapper inside the `transform` function to produce objects where `id` and `updatedAt` can be read consistently.

Legacy Lightyear-style methods (if used directly):

- `getNoun()`, `validateListResponse()`, `mapExternalToObject()`, `mapObjectDataToExternalData()` can be emulated via the SDK’s `responseSchema`, `transform`, and `transformRequest` hooks.

## Progress, Resumption, and Ordering

- The platform tracks per-sync state: `type`, `modelStatuses`, `lastBatch`, `currentModelName`, `currentDirection`.
- Collection-level resumption:
  - Resume from `sync.currentModel.name` by slicing the model list from that item onward.
- Model-level resumption:
  - `currentDirection` dictates which phase to resume. If it is `PUSH`, skip the pull phase on resume.
  - The platform tracks `lastBatch.cursor` per model. When resuming a model, start with that `cursor`.
  - For pull, use the latest `lastExternalId` and `lastExternalUpdatedAt` to fetch incremental pages.
  - After a model finishes both phases, `SyncConnector` must set `currentDirection` to `null`.

## Time Limits and Reruns

- A global run time limit is enforced (`base/time.ts`, currently 60s). When exceeded during pull or push:
  - Call `pauseSync(syncId)` and throw `RERUN`.
  - The calling action should propagate `RERUN` to the host so the run is re-triggered. Do not call `finishSync` in this case.

## Platform API Interactions

- Collections and Models
  - `getModels({ collectionName })` -> ordered model list from the platform
  - `getSync({ syncId })` -> current sync state
  - `updateSync({ syncId, type?, status?, currentModelName?, currentDirection? })`
  - `pauseSync(syncId)`, `finishSync(syncId)`
- Pull
  - `upsertObjectBatch({ collectionName, syncId, modelName, app, customApp, managedUserId, objects, cursor?, overwrite?, async? })`
- Push
  - `retrieveDelta({ collectionName, syncId, modelName })` (includes built-in retry/backoff for 423 Locked)
  - `confirmChangeBatch({ syncId, changes, async? })` or `confirmChange({ syncId, changeId, externalId, externalUpdatedAt })`

SDK note: The SDK builder itself does not include these platform calls. The AI SDK `sync` implementation must invoke these platform APIs when running inside Lightyear, using the configured model connector operations to fulfill pulls/pushes.

## Error Handling & Idempotency

- Throw on missing auth/managed user.
- Pull is safe to retry due to idempotent upsert semantics on the platform. Always provide stable `externalId` and `externalUpdatedAt`.
- Push must confirm successfully applied changes; otherwise, they will be re-delivered.
- Handle external API errors within `list`/`createBatch`/`updateBatch`/`deleteBatch` appropriately and surface failures by throwing to abort the phase. The action wrapper will call `finishSync` for non-rerun failures.

## Logging (recommended)

- Log phase transitions and counts:
  - Starting pull/push for model, pages/changes processed, and completion messages.
  - Useful debug logs: `lastExternalId`, `lastExternalUpdatedAt`, `cursor`, and deltas received.

## Acceptance Criteria

- Pull-only runs process all external pages, upserting objects and advancing watermarks, then complete.
- Push-only runs drain the delta queue by applying changes and confirming each change, then complete.
- Bidirectional runs execute pull then push (unless resuming with `currentDirection === "PUSH"`).
- Resumption semantics:
  - Resumes mid-collection from `currentModelName`.
  - Resumes mid-model with `lastBatch.cursor` and respects `currentDirection`.
- On time-limit exceed, the run pauses and signals `RERUN`; the next run resumes correctly without duplicating work.
- Missing model connectors are skipped gracefully (no crash) when not present in the configured model connectors (i.e., `getModelConnector(modelName)` returns `undefined`).
- SDK parity: `SyncConnector.sync()` and `ModelConnector.sync()` accept no parameters, derive `syncId` and direction from context/the sync record, integrate the builder-configured model operations with platform APIs; support cursor/page/offset pagination loops; use `bulk.*` when present; and pass watermarks to list requests.

## Notes for Implementers

- The Sync Connector maintains model connectors configured via the SDK builder and accessible through `getModelConnector(modelName)`. The platform’s `getModels()` list defines the authoritative order and subset to sync.
- `ModelConnector` implementations should batch API calls efficiently and respect provider rate limits.
- If the external API exposes reliable watermarks beyond `updatedAt`, incorporate them in `list` to maximize incremental efficiency.
- In the SDK, prefer using `responseSchema` for validation and `transform`/`transformRequest` for shape mapping. Ensure `T` exposes stable `id` and `updatedAt` for watermarking.
