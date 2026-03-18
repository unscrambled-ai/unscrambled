/**
 * Builders module - Re-exports all builder classes and helpers
 */

// Model builder
export { ModelBuilder, defineModel } from "./model";

// Collection builder
export { CollectionBuilder, defineCollection } from "./collection";

// Custom App builder
export {
  CustomAppBuilder,
  defineCustomApp,
  defineOAuth2CustomApp,
  defineApiKeyCustomApp,
  defineBasicCustomApp,
} from "./customApp";

// Integration builder
export { IntegrationBuilder, defineIntegration } from "./integration";

// Action builder
export { ActionBuilder, defineAction } from "./action";

// OAuth connector builder
export {
  OAuthConnectorBuilder,
  createOAuthConnector,
  defineOAuthConnector,
} from "./oauth";

// REST connector builder
export {
  RestConnectorBuilder,
  createRestConnector,
  defineRestConnector,
} from "./restConnector";

// Sync connector builder
export {
  SyncConnectorBuilder,
  SyncConnector,
  SyncModelConnectorBuilder,
  ModelConnectorConfigBuilder,
  createSyncConnector,
  createListConfig,
  createCreateConfig,
  createUpdateConfig,
  createDeleteConfig,
} from "./syncConnector";

export type {
  ModelConnector,
  ModelConnectorConfig,
  ListConfig,
  ListParams,
  CreateConfig,
  UpdateConfig,
  DeleteConfig,
  BatchCreateOperationConfig,
  BatchUpdateOperationConfig,
  BatchDeleteOperationConfig,
  SyncObject,
} from "./syncConnector";

// Typed sync helpers
export {
  createListResponseSchema,
  createPaginatedResponseSchema,
  validateModelExists,
  extractNestedData,
  batchItems,
  createModelConfig,
  type InferZodType,
} from "./typedSyncHelpers";

// Match pattern helpers
export { match } from "./match";

// Model connector builder
export {
  ModelConnectorBuilder,
  createModelConnector,
  type InferModelType,
} from "./modelConnector";
