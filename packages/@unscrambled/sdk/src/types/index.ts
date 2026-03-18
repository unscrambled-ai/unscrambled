import type { JSONSchema7 } from "json-schema";
import type { z } from "zod";
import type { FromSchema } from "json-schema-to-ts";

/**
 * Core types for collections and models
 */

// Match pattern types
export type SimpleMatchPattern = string;
export type JsonPathMatchPattern = `$${string}`;

export interface OrMatchPattern {
  or: MatchPattern[];
}

export interface AndMatchPattern {
  and: MatchPattern[];
}

export type MatchPattern =
  | SimpleMatchPattern
  | JsonPathMatchPattern
  | OrMatchPattern
  | AndMatchPattern;

// Model definition
export interface Model<TSchema = unknown, TName extends string = string> {
  name: TName;
  title?: string;
  // Accept JSON Schema, const object schemas (Readonly), and Zod schemas while
  // preserving the generic TSchema for inference.
  schema?: TSchema extends Readonly<any>
    ? TSchema
    : TSchema extends z.ZodType<any>
    ? TSchema
    : JSONSchema7;
  matchPattern?: MatchPattern;
}

// Collection definition
export interface Collection {
  name: string;
  title?: string;
  models: Model<any, any>[];
  // Optional method for type-safe model access
  getModel?(name: string): Model<any, any> | undefined;
}

// App authentication types
export type AppAuthType = "OAUTH2" | "APIKEY" | "BASIC";

// Variable definition for apps
export interface AppVariable {
  name: string;
  title?: string;
  description?: string;
  defaultValue?: string;
  required?: boolean;
}

// Secret definition for apps
export interface AppSecret {
  name: string;
  title?: string;
  description?: string;
  required?: boolean;
}

// OAuth connector types
export interface OAuthConnectorClass {
  new (props: any): any;
}

export interface OAuthConnectorFactory {
  (props: any): any;
}

// Custom app definition
export interface CustomApp {
  name: string;
  type: AppAuthType;
  title?: string;
  variables?: AppVariable[];
  secrets?: AppSecret[];
  oauthConnector?: OAuthConnectorClass | OAuthConnectorFactory;
  /**
   * If true, marks this custom app as the developer's own product (first-party).
   * Useful for distinguishing between third-party integrations and first-party apps.
   */
  isOwnApp?: boolean;
}

// Integration definition
export interface Integration {
  name: string;
  title?: string;
  description?: string;
  app: {
    type: "builtin" | "custom";
    name: string;
    definition?: CustomApp;
  };
  collection: Collection;
  actions: Record<string, Action>;
  syncSchedules?: SyncSchedule[];
  readOnly?: boolean; // If true, entire integration is read-only (skip push operations)
  writeOnly?: boolean; // If true, entire integration is write-only (skip pull operations)
  modelPermissions?: Array<{
    model: string; // Model name
    readOnly?: boolean; // If true, this model is read-only
    writeOnly?: boolean; // If true, this model is write-only
  }>; // Array of model-specific permissions
}

// Run function types for action execution
export interface Auths {
  [name: string]: any; // AuthData would be defined elsewhere
}

export interface Variables {
  [name: string]: string | null;
}

export interface Secrets {
  [name: string]: string | null;
}

export interface RunFuncIntegration {
  id: string;
  name: string;
  title: string;
}

export interface RunFuncManagedUser {
  id: string;
  externalId: string;
  displayName: string | null;
}

export interface RunFuncProps {
  data?: any;
  context?: any;
  auths: Auths;
  variables: Variables;
  secrets: Secrets;
  webhook: string | null;
  integration: RunFuncIntegration | null;
  managedUser: RunFuncManagedUser | null;
}

export type RunFunc = (props: RunFuncProps) => Promise<void>;

// Action types
export type ActionType = "FULL_SYNC" | "INCREMENTAL_SYNC";

// Action definition
export interface Action {
  name: string;
  title?: string;
  description?: string;
  type?: ActionType;
  variables?: AppVariable[];
  secrets?: AppSecret[];
  run?: RunFunc;
}

// Sync Connector types
export type SyncOperation = "create" | "update" | "delete";
export type SyncMode = "full" | "incremental";

// Sync Schedule types
export type SyncScheduleType = "INCREMENTAL" | "FULL" | "BASELINE";

export interface SyncSchedule {
  type: SyncScheduleType;
  every?: number | string;
  maxRetries?: number; // Required when type is "BASELINE"
}

export interface SyncState {
  lastSyncTime?: Date;
  cursor?: string;
  version?: string;
  [key: string]: any;
}

export interface ListResponse<T = any> {
  items: T[];
  nextState?: Partial<SyncState>;
  hasMore?: boolean;
}

export interface SyncResult {
  read: {
    created: number;
    updated: number;
    errors: Array<{ item: any; error: string }>;
  };
  write: {
    created: number;
    updated: number;
    deleted: number;
    errors: Array<{ change: any; error: string }>;
  };
}

export interface SyncConnectorDefinition {
  name: string;
  title?: string;
  collection: Collection;
  connectorType: "rest" | "graphql" | "custom";
  sync(mode: SyncMode): Promise<SyncResult>;
}

// Type helper to infer the data type of a model from its schema
export type InferModelData<M> = M extends Model<infer S>
  ? S extends import("zod").ZodType<infer R>
    ? R
    : S extends Readonly<any>
    ? FromSchema<S>
    : unknown
  : unknown;

// Helper to find a model by name in an array
type FindModel<Models, Name extends string> = Models extends readonly any[]
  ? Extract<Models[number], { name: Name }>
  : never;

// Helper to infer a model's data type from a collection and model name literal
export type InferModelDataFromCollection<C, N extends string> =
  // If builder preserved a precomputed name->data map, use it first to avoid deep instantiation
  C extends { __modelData?: infer Map extends Record<string, any> }
    ? N extends keyof Map
      ? Map[N]
      : unknown
    : C extends { __models?: infer TypedModels }
    ? FindModel<TypedModels, N> extends Model<infer S, any>
      ? InferModelData<Model<S, N>>
      : unknown
    : C extends { __schemas?: infer Schemas }
    ? Schemas extends Record<string, any>
      ? N extends keyof Schemas
        ? Schemas[N] extends JSONSchema7
          ? FromSchema<Schemas[N]>
          : unknown
        : C extends { models: infer Models }
        ? FindModel<Models, N> extends Model<infer S, any>
          ? InferModelData<Model<S, N>>
          : unknown
        : unknown
      : C extends { models: infer Models }
      ? FindModel<Models, N> extends Model<infer S, any>
        ? InferModelData<Model<S, N>>
        : unknown
      : unknown
    : C extends { models: infer Models }
    ? FindModel<Models, N> extends Model<infer S, any>
      ? InferModelData<Model<S, N>>
      : unknown
    : unknown;

// Concise alias matching the desired API style: Infer<typeof collection, 'modelName'>
export type Infer<C, N extends string> = InferModelDataFromCollection<C, N>;
