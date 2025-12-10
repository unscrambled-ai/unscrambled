import { z } from "zod";
import type { Collection, InferModelDataFromCollection } from "../types";
import type { RestConnector } from "../connectors/RestConnector";
import {
  getModels,
  getSync,
  updateSync,
  upsertObjectBatch,
  retrieveDelta,
  confirmChangeBatch,
  continueSync,
  startSync,
  finishSync,
  getUnconfirmedChanges,
} from "../platform/sync";
import { getCurrentContext, getLogCapture } from "../logging";
import { isTemporaryHttpError } from "../utils/httpErrors";
import { isTimeLimitExceeded, resetTimeLimit } from "../utils/time";
import { ChangeProcessor } from "../platform/changeProcessor";
import { validateAgainstSchema } from "../utils/schemaValidation";
import { ValidationError } from "../utils/ValidationError";

// Removed legacy PaginationConfig (page/offset types no longer supported)

export interface ListParams {
  cursor?: string;
  page?: number;
  offset?: number;
  limit?: number;
  lastExternalId?: string;
  lastExternalUpdatedAt?: string;
  syncType: "FULL" | "INCREMENTAL" | "BASELINE";
}

// Prevents TypeScript from inferring a type parameter from a usage site.
// Useful when we want inference to come solely from another argument (e.g., a literal model name).
type NoInfer<T> = [T][T extends any ? 0 : never];

export type SyncObject<TModel> = {
  externalId: string;
  externalUpdatedAt: string | null;
  data: TModel;
};

export interface BatchCreateChange<TModel = any> {
  changeId: string;
  data: TModel;
  obj: TModel;
  id?: string;
  [key: string]: any;
}

export interface BatchUpdateChange<TModel = any> {
  changeId: string;
  externalId: string;
  data: Partial<TModel>;
  obj: Partial<TModel>;
  id?: string;
  [key: string]: any;
}

export interface BatchDeleteChange {
  changeId: string;
  externalId: string;
  id?: string;
  [key: string]: any;
}

export interface BatchConfirmation {
  changeId: string;
  externalId: string;
  externalUpdatedAt?: string | null;
}

export type BatchCreateRequestItems<TModel> =
  | Array<TModel>
  | Array<BatchCreateChange<TModel>>;

type BatchCreateResponseItems<TModel> =
  | Array<TModel>
  | Array<BatchConfirmation>;

export type BatchUpdateRequestItems<TModel> = Array<BatchUpdateChange<TModel>>;

type BatchUpdateResponseItems<TModel> =
  | Array<TModel>
  | Array<BatchConfirmation>;

export type BatchDeleteRequestItems = Array<BatchDeleteChange>;

type BatchDeleteResponseItems = Array<BatchConfirmation>;

export interface ListFilterArgs<TModel = any> {
  obj: SyncObject<TModel>;
  lastExternalId?: string;
  lastExternalUpdatedAt?: string;
  syncType: "FULL" | "INCREMENTAL" | "BASELINE";
}

export interface ListConfig<TModel = any, TResponse = unknown> {
  request: (params: ListParams) => {
    endpoint: string;
    method?: "GET" | "POST";
    params?: Record<string, any>;
    /** @deprecated Use `json` for JSON payloads */
    data?: any;
    json?: any;
  };
  responseSchema?: z.ZodType<TResponse>;
  /**
   * Pagination: function that extracts pagination state from the response.
   * If omitted, a single request is made.
   */
  pagination?: (args: {
    response: any;
    cursor?: string;
    page?: number;
    offset?: number;
    limit?: number;
    lastExternalId?: string;
    lastExternalUpdatedAt?: string;
    syncType: "FULL" | "INCREMENTAL" | "BASELINE";
  }) => {
    cursor?: string | null;
    page?: number | null;
    offset?: number | null;
    hasMore: boolean;
  };
  // Optional transform to map raw response to an array of sync-ready objects
  transform?: (response: TResponse) => Array<SyncObject<TModel>>;
  filter?: (args: ListFilterArgs<TModel>) => boolean;
}

export interface CreateConfig<T = any> {
  request: (obj: T) => {
    endpoint: string;
    method?: "POST" | "PUT";
    /** @deprecated Use `json` for JSON payloads */
    data?: any;
    json?: any;
  };
  responseSchema?: z.ZodType<T>;
  /** Optionally transform the user-provided data before sending the request */
  transformRequest?: (data: T) => any;
  /** Optionally transform the raw or validated response into the final model */
  transform?: (response: any) => T;
  extract: (item: T) => {
    externalId: string;
    externalUpdatedAt: string | null;
  };
}

export interface UpdateConfig<T = any> {
  request: (
    id: string,
    obj: Partial<T>
  ) => {
    endpoint: string;
    method?: "PUT" | "PATCH" | "POST";
    /** @deprecated Use `json` for JSON payloads */
    data?: any;
    json?: any;
  };
  responseSchema?: z.ZodType<T>;
  /** Optionally transform the user-provided partial data before sending the request */
  transformRequest?: (data: Partial<T>) => any;
  /** Optionally transform the raw or validated response into the final model */
  transform?: (response: any) => T;
  extract: (item: T) => {
    externalId?: string;
    externalUpdatedAt: string | null;
  };
}

export interface DeleteConfig {
  request: (id: string) => {
    endpoint: string;
    method?: "DELETE" | "POST";
    /** @deprecated Use `json` for JSON payloads */
    data?: any;
    json?: any;
  };
}

export interface BatchCreateOperationConfig<T = any> {
  request: (items: BatchCreateRequestItems<T>) => {
    endpoint: string;
    method?: "POST" | "PUT";
    /** @deprecated Use `json` for JSON payloads */
    data?: any;
    json?: any;
  };
  responseSchema?: z.ZodType<any>;
  extract?: (response: any) => Array<BatchConfirmation>;
  payloadType?: "items" | "changes";
  batchSize?: number;
}

export interface BatchUpdateOperationConfig<T = any> {
  request: (items: BatchUpdateRequestItems<T>) => {
    endpoint: string;
    method?: "PUT" | "PATCH" | "POST";
    /** @deprecated Use `json` for JSON payloads */
    data?: any;
    json?: any;
  };
  responseSchema?: z.ZodType<any>;
  extract?: (response: any) => Array<BatchConfirmation>;
  payloadType?: "items" | "changes";
  batchSize?: number;
}

export interface BatchDeleteOperationConfig {
  request: (items: BatchDeleteRequestItems) => {
    endpoint: string;
    method?: "DELETE" | "POST";
    /** @deprecated Use `json` for JSON payloads */
    data?: any;
    json?: any;
  };
  responseSchema?: z.ZodType<any>;
  extract?: (response: any) => Array<BatchConfirmation>;
  payloadType?: "ids" | "changes";
  batchSize?: number;
}

export interface ModelConnectorConfig<T = any> {
  list?: ListConfig<T, any>;
  create?: CreateConfig<T>;
  update?: UpdateConfig<T>;
  delete?: DeleteConfig;
  batchCreate?: BatchCreateOperationConfig<T>;
  batchUpdate?: BatchUpdateOperationConfig<T>;
  batchDelete?: BatchDeleteOperationConfig;
}

// Type-safe config builder interfaces
export interface TypedListConfig<TModel, TResponse> {
  request: (params: ListParams) => {
    endpoint: string;
    method?: "GET" | "POST";
    params?: Record<string, any>;
    /** @deprecated Use `json` for JSON payloads */
    data?: any;
    json?: any;
  };
  responseSchema?: z.ZodType<TResponse>;
  pagination?: (args: {
    response: any;
    cursor?: string;
    page?: number;
    offset?: number;
    limit?: number;
    syncType: "FULL" | "INCREMENTAL" | "BASELINE";
  }) => {
    cursor?: string | null;
    page?: number | null;
    offset?: number | null;
    hasMore: boolean;
  };
  transform?: (response: TResponse) => Array<SyncObject<TModel>>;
  filter?: (args: ListFilterArgs<TModel>) => boolean;
}

export interface TypedModelConnectorConfig<TModel> {
  list?: TypedListConfig<TModel, any>;
  create?: CreateConfig<TModel>;
  update?: UpdateConfig<TModel>;
  delete?: DeleteConfig;
  batchCreate?: BatchCreateOperationConfig<TModel>;
  batchUpdate?: BatchUpdateOperationConfig<TModel>;
  batchDelete?: BatchDeleteOperationConfig;
}

// Helper type to infer response type from schema
type InferResponseType<S> = S extends z.ZodType<infer R> ? R : any;

// Type-safe list config that infers response type from schema
export interface TypeSafeListConfig<
  TModel,
  TResponseSchema extends z.ZodType<any> | undefined = undefined
> {
  request: (params: ListParams) => {
    endpoint: string;
    method?: "GET" | "POST";
    params?: Record<string, any>;
    /** @deprecated Use `json` for JSON payloads */
    data?: any;
    json?: any;
  };
  responseSchema?: TResponseSchema;
  pagination?: (args: {
    response: any;
    cursor?: string;
    page?: number;
    offset?: number;
    limit?: number;
    syncType: "FULL" | "INCREMENTAL" | "BASELINE";
  }) => {
    cursor?: string | null;
    page?: number | null;
    offset?: number | null;
    hasMore: boolean;
  };
  transform?: TResponseSchema extends z.ZodType<any>
    ? (
        response: InferResponseType<TResponseSchema>
      ) => Array<SyncObject<TModel>>
    : (response: unknown) => Array<SyncObject<TModel>>;
  filter?: (args: ListFilterArgs<TModel>) => boolean;
}

export interface ModelConnector<T = any> {
  modelName: string;
  config: ModelConnectorConfig<T>;
  list?: (params?: ListParams) => Promise<{
    items: Array<SyncObject<T>>;
    pagination: {
      cursor?: string;
      page?: number;
      offset?: number;
      hasMore: boolean;
    };
  }>;
  create?: (data: T) => Promise<T>;
  update?: (id: string, data: Partial<T>) => Promise<T>;
  delete?: (id: string) => Promise<void>;
  batchCreate?: (
    items: BatchCreateRequestItems<T>
  ) => Promise<BatchCreateResponseItems<T>>;
  batchUpdate?: (
    items: BatchUpdateRequestItems<T>
  ) => Promise<BatchUpdateResponseItems<T>>;
  batchDelete?: (
    items: BatchDeleteRequestItems
  ) => Promise<BatchDeleteResponseItems>;
}

type ExtractModels<T> = T extends { __modelData?: infer Map }
  ? Extract<keyof Map, string>
  : T extends { models: ReadonlyArray<{ name: infer N }> }
  ? Extract<N, string>
  : string;

type InferModelType<C extends Collection, M extends string> = C extends {
  __modelData?: infer Map extends Record<string, any>;
}
  ? M extends keyof Map
    ? Map[M]
    : any
  : any;

// Force distribution over union types
type DistributiveInferModelType<C extends Collection, M> = M extends string
  ? InferModelType<C, M>
  : never;

// Distributive conditional type to handle model type extraction
type DistributeModelType<C extends Collection, M> = M extends string
  ? InferModelType<C, M>
  : never;

// Helper to extract the exact type for a specific model name
type ExtractSpecificModelType<
  C extends Collection,
  M extends string
> = C extends { __modelData?: infer Data }
  ? Data extends Record<string, any>
    ? M extends keyof Data
      ? Data[M]
      : never
    : never
  : never;

// Create a mapped type for model connectors
type ModelConnectorMap<C extends Collection> = {
  [K in ExtractModels<C>]: (
    builder: SyncModelConnectorBuilder<InferModelType<C, K>>
  ) => SyncModelConnectorBuilder<any>;
};

/**
 * Builder for creating sync connectors with model configurations.
 *
 * By default, uses async writes for batch operations to improve performance.
 *
 * @example
 * ```typescript
 * // Default: async writes enabled
 * const connector = createSyncConnector(restConnector, collection)
 *   .withModelConnector("contacts", builder => ...)
 *   .build();
 *
 * ```
 */
export class SyncConnectorBuilder<
  TRestConnector extends RestConnector = RestConnector,
  TCollection extends Collection = Collection
> {
  private restConnector: TRestConnector;
  private collection: TCollection;
  private modelConnectors: Map<string, ModelConnector> = new Map();

  constructor(restConnector: TRestConnector, collection: TCollection) {
    this.restConnector = restConnector;
    this.collection = collection;
  }

  /**
   * Copy-constructor: create a builder from an existing SyncConnectorBuilder or SyncConnector
   */
  static from<RC extends RestConnector, C extends Collection>(
    source: SyncConnectorBuilder<RC, C> | SyncConnector<RC, C>
  ): SyncConnectorBuilder<RC, C> {
    if (source instanceof SyncConnectorBuilder) {
      const builder = new SyncConnectorBuilder<RC, C>(
        (source as any).restConnector,
        (source as any).collection
      );
      const existing = (source as any).modelConnectors as Map<
        string,
        ModelConnector
      >;
      existing.forEach((connector, name) => {
        builder.add(name as any, (b: any) => {
          const cfg = (connector as any).config as ModelConnectorConfig<any>;
          const bb = new ModelConnectorConfigBuilder<any>();
          if (cfg.list) bb.list(cfg.list as any);
          if (cfg.create) bb.create(cfg.create);
          if (cfg.update) bb.update(cfg.update);
          if (cfg.delete) bb.delete(cfg.delete);
          if (cfg.batchCreate) bb.batchCreate(cfg.batchCreate as any);
          if (cfg.batchUpdate) bb.batchUpdate(cfg.batchUpdate as any);
          if (cfg.batchDelete) bb.batchDelete(cfg.batchDelete as any);
          return bb;
        });
      });
      return builder;
    }

    const restConnector = (source as SyncConnector<RC, C>).getRestConnector();
    const collection = (source as SyncConnector<RC, C>).getCollection();
    const builder = new SyncConnectorBuilder<RC, C>(restConnector, collection);
    for (const model of collection.models) {
      const connector = (source as SyncConnector<RC, C>).getModelConnector(
        model.name as any
      ) as ModelConnector<any> | undefined;
      if (connector && (connector as any).config) {
        const cfg = (connector as any).config as ModelConnectorConfig<any>;
        builder.with(model.name as any, cfg as ModelConnectorConfig<any>);
      }
    }
    return builder;
  }

  with<const M extends ExtractModels<TCollection>>(
    modelName: M,
    config: ModelConnectorConfig<InferModelType<TCollection, NoInfer<M>>>
  ): this {
    const model = this.collection.models.find((m) => m.name === modelName);

    if (!model) {
      throw new Error(
        `Model "${modelName}" does not exist in collection "${this.collection.name}". ` +
          `Available models: ${this.collection.models
            .map((m) => m.name)
            .join(", ")}`
      );
    }

    const connector: ModelConnector = {
      modelName,
      config,
    };

    if (config.list) {
      connector.list = async (params: ListParams = { syncType: "FULL" }) => {
        // Build request from provided params (no nested pagination)
        const _params: ListParams = params || ({ syncType: "FULL" } as any);
        const requestConfig = config.list!.request(_params);

        const listReq: any = {
          method: requestConfig.method || "GET",
          url: requestConfig.endpoint,
          params: requestConfig.params,
        };
        const maybeData = requestConfig.json ?? requestConfig.data;
        if (maybeData !== undefined) listReq.data = maybeData;
        const response = await this.restConnector.request(listReq);

        let data = response.data;
        let items: Array<SyncObject<any>> = [];

        if (config.list!.responseSchema) {
          try {
            data = config.list!.responseSchema.parse(data);
          } catch (error: any) {
            // Enhance error message to show it's during response validation
            const errorMessage = error?.issues
              ? JSON.stringify(error.issues, null, 2)
              : String(error);
            throw new Error(
              `Response validation failed for model "${modelName}" list operation.\n` +
                `Endpoint: ${requestConfig.endpoint}\n` +
                `This error occurred while validating the API response against the configured responseSchema.\n` +
                `Validation errors:\n${errorMessage}`
            );
          }
        }

        // Apply required transform into platform object shape
        try {
          let rawItems: any[];
          if (config.list!.transform) {
            rawItems = config.list!.transform(data);
          } else {
            rawItems = Array.isArray(data) ? data : [];
          }

          // Convert items to SyncObject format (handles both transform and non-transform cases)
          items = rawItems.map((item: any, index: number) => {
            // Check if item is already a SyncObject (has 'data' property)
            if (item && typeof item === "object" && "data" in item) {
              return item as SyncObject<any>;
            }
            // Convert plain object to SyncObject format
            // Use 'id' or 'externalId' as the externalId, fallback to index if neither exists
            const externalId = String(
              item?.id ?? item?.externalId ?? `item-${index}`
            );
            const externalUpdatedAt =
              item?.updatedAt ??
              item?.externalUpdatedAt ??
              item?.updated_at ??
              null;
            return {
              externalId,
              externalUpdatedAt: externalUpdatedAt
                ? String(externalUpdatedAt)
                : null,
              data: item,
            };
          });
        } catch (error: any) {
          throw new Error(
            `Transform function failed for model "${modelName}" list operation.\n` +
              `Endpoint: ${requestConfig.endpoint}\n` +
              `This error occurred while transforming the API response data.\n` +
              `Error: ${error?.message || String(error)}`
          );
        }

        // Validate each item's data field against the model schema
        if (model.schema && items.length > 0) {
          items.forEach((item, index) => {
            try {
              // Handle case where item might be undefined or null
              if (!item) {
                throw new Error("Item is undefined or null");
              }
              validateAgainstSchema(
                item.data,
                model.schema as any,
                `Model "${modelName}" list item ${index}`
              );
            } catch (error: any) {
              // Re-throw with additional context
              const errorMessage = error?.message || String(error);
              throw new Error(
                `Model schema validation failed for model "${modelName}" at item ${index}.\n` +
                  `This error occurred after the transform step, while validating each item's data against the model schema.\n` +
                  `Item externalId: ${item?.externalId ?? "undefined"}\n` +
                  `Validation error: ${errorMessage}`
              );
            }
          });
        }

        if (config.list!.filter) {
          items = items.filter((obj) =>
            config.list!.filter!({
              obj,
              lastExternalId: _params.lastExternalId,
              lastExternalUpdatedAt: _params.lastExternalUpdatedAt,
              syncType: _params.syncType,
            })
          );
        }

        // Extract pagination info
        const pg = config.list!.pagination as
          | ((args: {
              response: any;
              cursor?: string;
              page?: number;
              offset?: number;
              limit?: number;
              lastExternalId?: string;
              lastExternalUpdatedAt?: string;
              syncType: "FULL" | "INCREMENTAL" | "BASELINE";
            }) => {
              cursor?: string | null;
              page?: number | null;
              offset?: number | null;
              hasMore: boolean;
            })
          | undefined;
        const res =
          typeof pg === "function"
            ? pg({
                response: data,
                cursor: _params.cursor,
                page: _params.page,
                offset: _params.offset,
                limit: _params.limit,
                lastExternalId: _params.lastExternalId,
                lastExternalUpdatedAt: _params.lastExternalUpdatedAt,
                syncType: _params.syncType,
              })
            : undefined;
        const pagination = {
          cursor: res?.cursor ?? undefined,
          page: res?.page ?? undefined,
          offset: res?.offset ?? undefined,
          hasMore: res?.hasMore ?? false,
        } as {
          cursor?: string;
          page?: number;
          offset?: number;
          hasMore: boolean;
        };

        return {
          items,
          pagination,
        };
      };
    }

    if (config.create) {
      connector.create = async (obj: any) => {
        // Allow optional request transformation
        const requestData = config.create!.transformRequest
          ? config.create!.transformRequest(obj)
          : obj;

        // Get request configuration from the function
        const requestConfig = config.create!.request(obj);

        const response = await this.restConnector.request({
          method: requestConfig.method || "POST",
          url: requestConfig.endpoint,
          data: requestConfig.json ?? requestConfig.data ?? requestData,
        });

        // Validate response if schema provided
        let validated = response.data;
        if ((config.create as any).responseSchema) {
          try {
            validated = (config.create as any).responseSchema.parse(
              response.data
            );
          } catch (error: any) {
            const errorMessage = error?.issues
              ? JSON.stringify(error.issues, null, 2)
              : String(error);
            throw new Error(
              `Response validation failed for model "${modelName}" create operation.\n` +
                `Endpoint: ${requestConfig.endpoint}\n` +
                `This error occurred while validating the API response against the configured responseSchema.\n` +
                `Validation errors:\n${errorMessage}`
            );
          }
        }

        // Optionally transform response into final model
        const result = (config.create as any).transform
          ? (config.create as any).transform(validated)
          : validated;

        // Validate the transformed result against the model schema
        if (model.schema) {
          validateAgainstSchema(
            result,
            model.schema as any,
            `Model "${modelName}" create result`
          );
        }

        return result as any;
      };
    }

    if (config.update) {
      connector.update = async (externalId: string, obj: any) => {
        // Allow optional request transformation
        const requestData = config.update!.transformRequest
          ? config.update!.transformRequest(obj)
          : obj;

        // Get request configuration from the function
        const requestConfig = config.update!.request(externalId, obj);

        const response = await this.restConnector.request({
          method: requestConfig.method || "PUT",
          url: requestConfig.endpoint,
          data: requestConfig.json ?? requestConfig.data ?? requestData,
        });

        // Validate response if schema provided
        let validated = response.data;
        if ((config.update as any).responseSchema) {
          try {
            validated = (config.update as any).responseSchema.parse(
              response.data
            );
          } catch (error: any) {
            const errorMessage = error?.issues
              ? JSON.stringify(error.issues, null, 2)
              : String(error);
            throw new Error(
              `Response validation failed for model "${modelName}" update operation.\n` +
                `Endpoint: ${requestConfig.endpoint}\n` +
                `This error occurred while validating the API response against the configured responseSchema.\n` +
                `Validation errors:\n${errorMessage}`
            );
          }
        }

        // Optionally transform response into final model
        const result = (config.update as any).transform
          ? (config.update as any).transform(validated)
          : validated;

        // Validate the transformed result against the model schema
        if (model.schema) {
          validateAgainstSchema(
            result,
            model.schema as any,
            `Model "${modelName}" update result`
          );
        }

        return result as any;
      };
    }

    if (config.delete) {
      connector.delete = async (externalId: string) => {
        // Get request configuration from the function
        const requestConfig = config.delete!.request(externalId);

        await this.restConnector.request({
          method: requestConfig.method || "DELETE",
          url: requestConfig.endpoint,
          json: requestConfig.json ?? requestConfig.data,
        });
      };
    }

    if (config.batchCreate) {
      connector.batchCreate = async (items: any[]) => {
        const batchSize = config.batchCreate!.batchSize || 100;
        const aggregatedResponses: any[] = [];
        const confirmations: BatchConfirmation[] = [];
        const isChangePayload = config.batchCreate!.payloadType === "changes";

        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          const formattedBatch = isChangePayload
            ? batch.map((item: any) => {
                const payload = item.data ?? item.obj ?? item.payload ?? item;
                return {
                  ...item,
                  data: payload,
                  obj: item.obj ?? payload,
                };
              })
            : batch;
          const requestConfig = config.batchCreate!.request(formattedBatch);

          const response = await this.restConnector.request({
            method: requestConfig.method || "POST",
            url: requestConfig.endpoint,
            data: requestConfig.json ?? requestConfig.data ?? formattedBatch,
          });

          let responseData = response.data;
          if (config.batchCreate!.responseSchema) {
            try {
              responseData =
                config.batchCreate!.responseSchema.parse(responseData);
            } catch (error: any) {
              const errorMessage = error?.issues
                ? JSON.stringify(error.issues, null, 2)
                : String(error);
              throw new Error(
                `Response validation failed for model "${modelName}" batchCreate operation.\n` +
                  `Endpoint: ${requestConfig.endpoint}\n` +
                  `Batch size: ${batch.length} items\n` +
                  `This error occurred while validating the API response against the configured responseSchema.\n` +
                  `Validation errors:\n${errorMessage}`
              );
            }
          }

          if (config.batchCreate!.extract) {
            const extracted = config.batchCreate!.extract(responseData) ?? [];
            confirmations.push(
              ...extracted.map((result) => ({
                changeId: String(result.changeId),
                externalId: String(result.externalId),
                externalUpdatedAt:
                  result.externalUpdatedAt === undefined ||
                  result.externalUpdatedAt === null
                    ? null
                    : String(result.externalUpdatedAt),
              }))
            );
          }

          aggregatedResponses.push(
            ...(Array.isArray(responseData) ? responseData : [responseData])
          );
        }

        return config.batchCreate!.extract
          ? confirmations
          : aggregatedResponses;
      };
    }

    if (config.batchUpdate) {
      connector.batchUpdate = async (items: BatchUpdateRequestItems<any>) => {
        const batchSize = config.batchUpdate!.batchSize || 100;
        const aggregatedResponses: any[] = [];
        const confirmations: BatchConfirmation[] = [];
        const payloadType =
          config.batchUpdate!.payloadType ??
          (config.batchUpdate!.extract ? "changes" : "items");

        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          const formattedBatch =
            payloadType === "changes"
              ? batch.map((item: BatchUpdateChange<any>) => {
                  const payload = item.data ?? item.obj ?? {};
                  const externalId = String(item.externalId ?? item.id);
                  return {
                    ...item,
                    externalId,
                    id: item.id ?? externalId,
                    data: payload,
                    obj: item.obj ?? payload,
                  };
                })
              : batch;
          const requestConfig = config.batchUpdate!.request(
            formattedBatch as any
          );

          const response = await this.restConnector.request({
            method: requestConfig.method || "PUT",
            url: requestConfig.endpoint,
            data: requestConfig.json ?? requestConfig.data ?? formattedBatch,
          });
          let responseData = response.data;
          if (config.batchUpdate!.responseSchema) {
            try {
              responseData =
                config.batchUpdate!.responseSchema!.parse(responseData);
            } catch (error: any) {
              const errorMessage = error?.issues
                ? JSON.stringify(error.issues, null, 2)
                : String(error);
              throw new Error(
                `Response validation failed for model "${modelName}" batchUpdate operation.\n` +
                  `Endpoint: ${requestConfig.endpoint}\n` +
                  `Batch size: ${batch.length} items\n` +
                  `This error occurred while validating the API response against the configured responseSchema.\n` +
                  `Validation errors:\n${errorMessage}`
              );
            }
          }

          if (config.batchUpdate!.extract) {
            const extracted = config.batchUpdate!.extract!(responseData) ?? [];
            confirmations.push(
              ...extracted.map((result) => ({
                changeId: String(result.changeId),
                externalId: String(result.externalId),
                externalUpdatedAt:
                  result.externalUpdatedAt === undefined ||
                  result.externalUpdatedAt === null
                    ? null
                    : String(result.externalUpdatedAt),
              }))
            );
          }

          aggregatedResponses.push(
            ...(Array.isArray(responseData) ? responseData : [responseData])
          );
        }

        return config.batchUpdate!.extract
          ? confirmations
          : aggregatedResponses;
      };
    }

    if (config.batchDelete) {
      connector.batchDelete = async (items: BatchDeleteRequestItems) => {
        const batchSize = config.batchDelete!.batchSize || 100;
        const confirmations: BatchConfirmation[] = [];
        const payloadType =
          config.batchDelete!.payloadType ??
          (config.batchDelete!.extract ? "changes" : "ids");

        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          const formattedBatch =
            payloadType === "changes"
              ? batch.map((item: BatchDeleteChange) => {
                  const externalId = String(item.externalId ?? item.id);
                  return {
                    ...item,
                    externalId,
                    id: item.id ?? externalId,
                  };
                })
              : batch;
          const requestConfig = config.batchDelete!.request(
            formattedBatch as any
          );

          const response = await this.restConnector.request({
            method: requestConfig.method || "DELETE",
            url: requestConfig.endpoint,
            data: requestConfig.json ?? requestConfig.data ?? formattedBatch,
          });

          if (config.batchDelete!.extract) {
            let responseData = response.data;
            if (config.batchDelete!.responseSchema) {
              try {
                responseData =
                  config.batchDelete!.responseSchema!.parse(responseData);
              } catch (error: any) {
                const errorMessage = error?.issues
                  ? JSON.stringify(error.issues, null, 2)
                  : String(error);
                throw new Error(
                  `Response validation failed for model "${modelName}" batchDelete operation.\n` +
                    `Endpoint: ${requestConfig.endpoint}\n` +
                    `Batch size: ${batch.length} items\n` +
                    `This error occurred while validating the API response against the configured responseSchema.\n` +
                    `Validation errors:\n${errorMessage}`
                );
              }
            }
            const extracted = config.batchDelete!.extract!(responseData) ?? [];
            confirmations.push(
              ...extracted.map((result) => ({
                changeId: String(result.changeId),
                externalId: String(result.externalId),
                externalUpdatedAt:
                  result.externalUpdatedAt === undefined ||
                  result.externalUpdatedAt === null
                    ? null
                    : String(result.externalUpdatedAt),
              }))
            );
          }
        }

        return confirmations;
      };
    }

    this.modelConnectors.set(modelName, connector);
    return this;
  }

  withModelConnector<const M extends ExtractModels<TCollection>>(
    modelName: M,
    configBuilder: (
      builder: SyncModelConnectorBuilder<
        InferModelDataFromCollection<TCollection, M>
      >
    ) => SyncModelConnectorBuilder<InferModelDataFromCollection<TCollection, M>>
  ): this {
    const model = this.collection.models.find((m) => m.name === modelName);

    if (!model) {
      throw new Error(
        `Model "${modelName}" does not exist in collection "${this.collection.name}". ` +
          `Available models: ${this.collection.models
            .map((m) => m.name)
            .join(", ")}`
      );
    }

    const builder = new SyncModelConnectorBuilder<
      InferModelDataFromCollection<TCollection, M>
    >();
    const configuredBuilder = configBuilder(builder);
    const config = configuredBuilder.build();

    // Reduce type computation depth by casting here
    return this.with(modelName, config as ModelConnectorConfig<any>);
  }

  add<M extends ExtractModels<TCollection>>(
    modelName: M,
    configBuilder: (
      builder: ModelConnectorConfigBuilder<InferModelType<TCollection, M>>
    ) => ModelConnectorConfigBuilder<InferModelType<TCollection, M>>
  ): this {
    const model = this.collection.models.find((m) => m.name === modelName);

    if (!model) {
      throw new Error(
        `Model "${modelName}" does not exist in collection "${this.collection.name}". ` +
          `Available models: ${this.collection.models
            .map((m) => m.name)
            .join(", ")}`
      );
    }

    const builder = new ModelConnectorConfigBuilder<
      InferModelType<TCollection, M>
    >();
    const configuredBuilder = configBuilder(builder);
    const config = configuredBuilder.build();

    // Reduce type computation depth by casting here; the builder itself remains strongly typed
    return this.with(modelName, config as ModelConnectorConfig<any>);
  }

  getModelConnector<M extends ExtractModels<TCollection>>(
    modelName: M
  ): ModelConnector<InferModelType<TCollection, M>> | undefined {
    return this.modelConnectors.get(modelName) as
      | ModelConnector<InferModelType<TCollection, M>>
      | undefined;
  }

  build(): SyncConnector<TRestConnector, TCollection> {
    return new SyncConnector(
      this.restConnector,
      this.collection,
      this.modelConnectors
    );
  }
}

export class SyncModelConnectorBuilder<T = any> {
  private config: ModelConnectorConfig<T> = {};

  withList<TSchema extends z.ZodType<any> = any>(config: {
    request: (params: ListParams) => {
      endpoint: string;
      method?: "GET" | "POST";
      params?: Record<string, any>;
      /** @deprecated Use `json` for JSON payloads */
      data?: any;
      json?: any;
    };
    responseSchema?: TSchema;
    pagination?: TSchema extends z.ZodType<any>
      ? (args: {
          response: z.infer<TSchema>;
          cursor?: string;
          page?: number;
          offset?: number;
          limit?: number;
          syncType: "FULL" | "INCREMENTAL" | "BASELINE";
        }) => {
          cursor?: string | null;
          page?: number | null;
          offset?: number | null;
          hasMore: boolean;
        }
      : (args: {
          response: unknown;
          cursor?: string;
          page?: number;
          offset?: number;
          limit?: number;
          syncType: "FULL" | "INCREMENTAL" | "BASELINE";
        }) => {
          cursor?: string | null;
          page?: number | null;
          offset?: number | null;
          hasMore: boolean;
        };
    transform?: TSchema extends z.ZodType<any>
      ? (response: z.infer<TSchema>) => Array<SyncObject<T>>
      : (response: unknown) => Array<SyncObject<T>>;
    filter?: (args: ListFilterArgs<T>) => boolean;
  }): this {
    this.config.list = config as any;
    return this;
  }

  withCreate<TSchema extends z.ZodType<any> | undefined = undefined>(config: {
    request: (obj: T) => {
      endpoint: string;
      method?: "POST" | "PUT";
      /** @deprecated Use `json` for JSON payloads */
      data?: any;
      json?: any;
    };
    responseSchema?: TSchema;
    /** Optionally transform the user-provided data before sending the request */
    transformRequest?: (data: T) => any;
    /** Optionally transform the raw or validated response into the final model */
    transform?: TSchema extends z.ZodType<any>
      ? (response: z.infer<TSchema>) => T
      : (response: unknown) => T;
    extract: (
      item: TSchema extends z.ZodType<any> ? z.infer<TSchema> : unknown
    ) => {
      externalId: string;
      externalUpdatedAt: string | null;
    };
  }): this {
    this.config.create = config as unknown as CreateConfig<T>;
    return this;
  }

  withUpdate<TSchema extends z.ZodType<any> | undefined = undefined>(config: {
    request: (
      externalId: string,
      obj: Partial<T>
    ) => {
      endpoint: string;
      method?: "PUT" | "PATCH" | "POST";
      /** @deprecated Use `json` for JSON payloads */
      data?: any;
      json?: any;
    };
    responseSchema?: TSchema;
    /** Optionally transform the user-provided partial data before sending the request */
    transformRequest?: (data: Partial<T>) => any;
    /** Optionally transform the raw or validated response into the final model */
    transform?: TSchema extends z.ZodType<any>
      ? (response: z.infer<TSchema>) => T
      : (response: unknown) => T;
    extract: (
      item: TSchema extends z.ZodType<any> ? z.infer<TSchema> : unknown
    ) => {
      externalId?: string;
      externalUpdatedAt: string | null;
    };
  }): this {
    this.config.update = config as unknown as UpdateConfig<T>;
    return this;
  }

  withDelete(config: {
    request: (externalId: string) => {
      endpoint: string;
      method?: "DELETE" | "POST";
      /** @deprecated Use `json` for JSON payloads */
      data?: any;
      json?: any;
    };
  }): this {
    this.config.delete = config;
    return this;
  }

  withBatchCreate<
    TSchema extends z.ZodType<any> | undefined = undefined
  >(config: {
    request: (changes: Array<BatchCreateChange<T>>) => {
      endpoint: string;
      method?: "POST" | "PUT";
      /** @deprecated Use `json` for JSON payloads */
      data?: any;
      json?: any;
    };
    responseSchema?: TSchema;
    extract?: (
      response: TSchema extends z.ZodType<any> ? z.infer<TSchema> : unknown
    ) => Array<BatchConfirmation>;
    batchSize?: number;
    payloadType?: "items" | "changes";
  }): this {
    this.config.batchCreate = {
      ...config,
      payloadType: config.payloadType ?? "changes",
    } as unknown as BatchCreateOperationConfig<T>;
    return this;
  }

  withBatchUpdate<
    TSchema extends z.ZodType<any> | undefined = undefined
  >(config: {
    request: (changes: Array<BatchUpdateChange<T>>) => {
      endpoint: string;
      method?: "PUT" | "PATCH" | "POST";
      /** @deprecated Use `json` for JSON payloads */
      data?: any;
      json?: any;
    };
    responseSchema?: TSchema;
    extract?: (
      response: TSchema extends z.ZodType<any> ? z.infer<TSchema> : unknown
    ) => Array<BatchConfirmation>;
    batchSize?: number;
    payloadType?: "items" | "changes";
  }): this {
    this.config.batchUpdate = {
      ...config,
      payloadType: config.payloadType ?? "changes",
    } as unknown as BatchUpdateOperationConfig<T>;
    return this;
  }

  withBatchDelete<
    TSchema extends z.ZodType<any> | undefined = undefined
  >(config: {
    request: (changes: Array<BatchDeleteChange>) => {
      endpoint: string;
      method?: "DELETE" | "POST";
      /** @deprecated Use `json` for JSON payloads */
      data?: any;
      json?: any;
    };
    responseSchema?: TSchema;
    extract?: (
      response: TSchema extends z.ZodType<any> ? z.infer<TSchema> : unknown
    ) => Array<BatchConfirmation>;
    batchSize?: number;
    payloadType?: "ids" | "changes";
  }): this {
    this.config.batchDelete = {
      ...config,
      payloadType: config.payloadType ?? "changes",
    } as unknown as BatchDeleteOperationConfig;
    return this;
  }

  build(): ModelConnectorConfig<T> {
    return this.config;
  }
}

export class ModelConnectorConfigBuilder<T = any> {
  private config: ModelConnectorConfig<T> = {};

  list<TSchema extends z.ZodType<any>>(config: {
    request: (params: ListParams) => {
      endpoint: string;
      method?: "GET" | "POST";
      params?: Record<string, any>;
      data?: any;
    };
    responseSchema: TSchema;
    pagination?: (response: z.infer<TSchema>) => {
      cursor?: string | null;
      page?: number | null;
      offset?: number | null;
      hasMore: boolean;
    };
    transform?: (response: z.infer<TSchema>) => Array<SyncObject<T>>;
    filter?: (args: ListFilterArgs<T>) => boolean;
  }): this {
    this.config.list = config as any;
    return this;
  }

  create<TSchema extends z.ZodType<any> | undefined = undefined>(config: {
    request: (obj: T) => {
      endpoint: string;
      method?: "POST" | "PUT";
      data?: any;
    };
    responseSchema?: TSchema;
    extract: (
      item: TSchema extends z.ZodType<any> ? z.infer<TSchema> : unknown
    ) => {
      externalId: string;
      externalUpdatedAt: string | null;
    };
  }): this {
    this.config.create = config as unknown as CreateConfig<T>;
    return this;
  }

  update<TSchema extends z.ZodType<any> | undefined = undefined>(config: {
    request: (
      externalId: string,
      obj: Partial<T>
    ) => {
      endpoint: string;
      method?: "PUT" | "PATCH" | "POST";
      data?: any;
    };
    responseSchema?: TSchema;
    extract: (
      item: TSchema extends z.ZodType<any> ? z.infer<TSchema> : unknown
    ) => {
      externalId?: string;
      externalUpdatedAt: string | null;
    };
  }): this {
    this.config.update = config as unknown as UpdateConfig<T>;
    return this;
  }

  delete(config: {
    request: (externalId: string) => {
      endpoint: string;
      method?: "DELETE" | "POST";
      data?: any;
    };
  }): this {
    this.config.delete = config;
    return this;
  }

  batchCreate(config: BatchCreateOperationConfig<T>): this {
    this.config.batchCreate = {
      ...config,
      payloadType: config.payloadType ?? "changes",
    } as BatchCreateOperationConfig<T>;
    return this;
  }

  withBatchCreate<
    TSchema extends z.ZodType<any> | undefined = undefined
  >(config: {
    request: (changes: Array<BatchCreateChange<T>>) => {
      endpoint: string;
      method?: "POST" | "PUT";
      data?: any;
      json?: any;
    };
    responseSchema?: TSchema;
    extract?: (
      response: TSchema extends z.ZodType<any> ? z.infer<TSchema> : unknown
    ) => Array<BatchConfirmation>;
    batchSize?: number;
    payloadType?: "items" | "changes";
  }): this {
    return this.batchCreate(config as unknown as BatchCreateOperationConfig<T>);
  }

  batchUpdate(config: BatchUpdateOperationConfig<T>): this {
    this.config.batchUpdate = {
      ...config,
      payloadType: config.payloadType ?? "changes",
    } as BatchUpdateOperationConfig<T>;
    return this;
  }

  withBatchUpdate<
    TSchema extends z.ZodType<any> | undefined = undefined
  >(config: {
    request: (changes: Array<BatchUpdateChange<T>>) => {
      endpoint: string;
      method?: "PUT" | "PATCH" | "POST";
      data?: any;
      json?: any;
    };
    responseSchema?: TSchema;
    extract?: (
      response: TSchema extends z.ZodType<any> ? z.infer<TSchema> : unknown
    ) => Array<BatchConfirmation>;
    batchSize?: number;
    payloadType?: "items" | "changes";
  }): this {
    return this.batchUpdate(config as unknown as BatchUpdateOperationConfig<T>);
  }

  batchDelete(config: BatchDeleteOperationConfig): this {
    this.config.batchDelete = {
      ...config,
      payloadType: config.payloadType ?? "changes",
    } as BatchDeleteOperationConfig;
    return this;
  }

  withBatchDelete<
    TSchema extends z.ZodType<any> | undefined = undefined
  >(config: {
    request: (changes: Array<BatchDeleteChange>) => {
      endpoint: string;
      method?: "DELETE" | "POST";
      data?: any;
      json?: any;
    };
    responseSchema?: TSchema;
    extract?: (
      response: TSchema extends z.ZodType<any> ? z.infer<TSchema> : unknown
    ) => Array<BatchConfirmation>;
    batchSize?: number;
    payloadType?: "ids" | "changes";
  }): this {
    return this.batchDelete(config as unknown as BatchDeleteOperationConfig);
  }

  build(): ModelConnectorConfig<T> {
    return this.config;
  }
}

export class SyncConnector<
  TRestConnector extends RestConnector = RestConnector,
  TCollection extends Collection = Collection
> {
  private restConnector: TRestConnector;
  private collection: TCollection;
  private modelConnectors: Map<string, ModelConnector>;

  constructor(
    restConnector: TRestConnector,
    collection: TCollection,
    modelConnectors: Map<string, ModelConnector>
  ) {
    this.restConnector = restConnector;
    this.collection = collection;
    this.modelConnectors = modelConnectors;
  }

  /**
   * Process batch create operations asynchronously
   * Uses regular http-request endpoint with async flag since the API supports batch operations
   */
  private async processBatchCreateAsync(
    connector: ModelConnector,
    changes: Array<any>,
    modelName: string,
    processor: ChangeProcessor
  ): Promise<void> {
    const batchSize = connector.config.batchCreate?.batchSize || 100;
    const payloadType =
      connector.config.batchCreate?.payloadType ??
      (connector.config.batchCreate?.extract ? "changes" : "items");

    const numBatches = Math.ceil(changes.length / batchSize);
    console.info(
      `Processing ${changes.length} CREATE changes for model ${modelName} in ${numBatches} batches (parallel)`
    );

    // Prepare all batch requests
    const batchRequests: Array<{
      promise: Promise<any>;
      batch: any[];
      batchExtractFn: any;
      requestConfig: any;
    }> = [];

    for (let i = 0; i < changes.length; i += batchSize) {
      const batch = changes.slice(i, i + batchSize);
      const formattedBatch =
        payloadType === "changes"
          ? batch.map((change: any) => ({
              ...change,
              data: change.data ?? change.obj ?? change.payload ?? null,
              obj: change.obj ?? change.data ?? change.payload ?? null,
            }))
          : batch.map((c: any) => c.data);

      const requestConfig =
        connector.config.batchCreate!.request(formattedBatch);
      const batchExtractFn = connector.config.batchCreate?.extract;

      // For batch operations with async, build proper syncInfo
      const requestBody: any = {
        method: requestConfig.method || "POST",
        url: requestConfig.endpoint,
        json: requestConfig.json ?? requestConfig.data ?? formattedBatch,
        async: true,
        syncInfo: {
          syncId: processor.getSyncId(),
          modelName,
          changeIds: batch.map((c) => c.changeId),
        },
      };

      batchRequests.push({
        promise: this.restConnector.request(requestBody),
        batch,
        batchExtractFn,
        requestConfig,
      });
    }

    // Send all batches in parallel
    const sendStart = Date.now();
    const responses = await Promise.all(batchRequests.map((r) => r.promise));
    const sendTime = Date.now() - sendStart;
    console.info(`✅ Sent ${numBatches} batches in parallel in ${sendTime}ms`);

    // Register extract functions after all requests complete
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const { batchExtractFn, batch } = batchRequests[i];

      // Create default extract function if none provided
      const extractFn =
        batchExtractFn ||
        ((responseData: any) => {
          // Default extraction logic for batch creates
          const items = Array.isArray(responseData)
            ? responseData
            : responseData?.results || responseData?.data || [];

          // Validate we have items
          if (!Array.isArray(items) || items.length === 0) {
            console.warn(
              `⚠️ Default extract function: Response does not contain an array of items. ` +
                `Expected array or object with 'results'/'data' property. ` +
                `Response type: ${typeof responseData}, ` +
                `Is array: ${Array.isArray(responseData)}, ` +
                `Has results: ${!!responseData?.results}, ` +
                `Has data: ${!!responseData?.data}`
            );
          }

          return batch.map((change: any, index: number) => {
            const item = items[index] || {};
            const externalId = item.id || item.externalId || change.externalId;

            // Warn if we couldn't find a valid external ID
            if (!externalId) {
              console.warn(
                `⚠️ Default extract function: Could not find externalId for change ${change.changeId} at index ${index}. ` +
                  `Item keys: ${Object.keys(item).join(", ")}`
              );
            }

            return {
              changeId: change.changeId,
              externalId: externalId ? String(externalId) : "",
              externalUpdatedAt:
                item.updatedAt ||
                item.externalUpdatedAt ||
                item.createdAt ||
                null,
            };
          });
        });

      // Register batch extract function (only once per model)
      const responseSchema = connector.config.batchCreate?.responseSchema;
      if (response.httpRequestId) {
        processor.registerBatchExtractFunction(
          response.httpRequestId,
          extractFn,
          responseSchema
        );
      } else if (!processor.hasBatchExtractFunctionForModel(modelName)) {
        processor.registerBatchExtractFunctionByModel(
          modelName,
          extractFn,
          responseSchema
        );
      }
    }
  }

  /**
   * Process batch update operations asynchronously
   * Uses regular http-request endpoint with async flag since the API supports batch operations
   */
  private async processBatchUpdateAsync(
    connector: ModelConnector,
    changes: Array<any>,
    modelName: string,
    processor: ChangeProcessor
  ): Promise<void> {
    const batchSize = connector.config.batchUpdate?.batchSize || 100;
    const payloadType =
      connector.config.batchUpdate?.payloadType ??
      (connector.config.batchUpdate?.extract ? "changes" : "items");

    const numBatches = Math.ceil(changes.length / batchSize);
    console.info(
      `Processing ${changes.length} UPDATE changes for model ${modelName} in ${numBatches} batches (parallel)`
    );

    // Prepare all batch requests
    const batchRequests: Array<{
      promise: Promise<any>;
      batch: any[];
      batchExtractFn: any;
    }> = [];

    for (let i = 0; i < changes.length; i += batchSize) {
      const batch = changes.slice(i, i + batchSize);
      const formattedBatch =
        payloadType === "changes"
          ? batch.map((change: any) => ({
              ...change,
              externalId: String(change.externalId ?? change.id),
              id: change.id ?? change.externalId,
              data: change.data ?? change.obj ?? {},
              obj: change.obj ?? change.data ?? {},
            }))
          : batch.map((c: any) => ({ id: c.externalId, data: c.data }));

      const requestConfig =
        connector.config.batchUpdate!.request(formattedBatch);
      const batchExtractFn = connector.config.batchUpdate?.extract;

      const requestBody: any = {
        method: requestConfig.method || "PUT",
        url: requestConfig.endpoint,
        json: requestConfig.json ?? requestConfig.data ?? formattedBatch,
        async: true,
        syncInfo: {
          syncId: processor.getSyncId(),
          modelName,
          changeIds: batch.map((c) => c.changeId),
        },
      };

      batchRequests.push({
        promise: this.restConnector.request(requestBody),
        batch,
        batchExtractFn,
      });
    }

    // Send all batches in parallel
    const sendStart = Date.now();
    const responses = await Promise.all(batchRequests.map((r) => r.promise));
    const sendTime = Date.now() - sendStart;
    console.info(`✅ Sent ${numBatches} batches in parallel in ${sendTime}ms`);

    // Register extract functions after all requests complete
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const { batchExtractFn, batch } = batchRequests[i];

      // Create default extract function if none provided
      const extractFn =
        batchExtractFn ||
        ((responseData: any) => {
          // Default extraction logic for batch updates
          const items = Array.isArray(responseData)
            ? responseData
            : responseData?.results || responseData?.data || [];

          // Validate we have items
          if (!Array.isArray(items) || items.length === 0) {
            console.warn(
              `⚠️ Default extract function (UPDATE): Response does not contain an array of items. ` +
                `Expected array or object with 'results'/'data' property. ` +
                `Response type: ${typeof responseData}, ` +
                `Is array: ${Array.isArray(responseData)}, ` +
                `Has results: ${!!responseData?.results}, ` +
                `Has data: ${!!responseData?.data}`
            );
          }

          return batch.map((change: any, index: number) => {
            const item = items[index] || {};
            const externalId = item.id || item.externalId || change.externalId;

            // Warn if we couldn't find a valid external ID
            if (!externalId) {
              console.warn(
                `⚠️ Default extract function (UPDATE): Could not find externalId for change ${change.changeId} at index ${index}. ` +
                  `Item keys: ${Object.keys(item).join(", ")}`
              );
            }

            return {
              changeId: change.changeId,
              externalId: externalId ? String(externalId) : "",
              externalUpdatedAt:
                item.updatedAt ||
                item.externalUpdatedAt ||
                item.createdAt ||
                null,
            };
          });
        });

      // Register batch extract function (only once per model)
      const responseSchema = connector.config.batchUpdate?.responseSchema;
      if (response.httpRequestId) {
        processor.registerBatchExtractFunction(
          response.httpRequestId,
          extractFn,
          responseSchema
        );
      } else if (!processor.hasBatchExtractFunctionForModel(modelName)) {
        processor.registerBatchExtractFunctionByModel(
          modelName,
          extractFn,
          responseSchema
        );
      }
    }
  }

  /**
   * Process batch delete operations asynchronously
   * Uses regular http-request endpoint with async flag since the API supports batch operations
   */
  private async processBatchDeleteAsync(
    connector: ModelConnector,
    changes: Array<any>,
    modelName: string,
    processor: ChangeProcessor
  ): Promise<void> {
    const batchSize = connector.config.batchDelete?.batchSize || 100;
    const payloadType =
      connector.config.batchDelete?.payloadType ??
      (connector.config.batchDelete?.extract ? "changes" : "ids");

    const numBatches = Math.ceil(changes.length / batchSize);
    console.info(
      `Processing ${changes.length} DELETE changes for model ${modelName} in ${numBatches} batches (parallel)`
    );

    // Prepare all batch requests
    const batchRequests: Array<{
      promise: Promise<any>;
      batch: any[];
      batchExtractFn: any;
    }> = [];

    for (let i = 0; i < changes.length; i += batchSize) {
      const batch = changes.slice(i, i + batchSize);
      const formattedBatch =
        payloadType === "changes"
          ? batch.map((change: any) => ({
              ...change,
              externalId: String(change.externalId ?? change.id),
              id: change.id ?? change.externalId,
            }))
          : batch.map((c: any) => ({
              changeId: c.changeId,
              externalId: String(c.externalId),
            }));

      const requestConfig =
        connector.config.batchDelete!.request(formattedBatch);
      const batchExtractFn = connector.config.batchDelete?.extract;

      const requestBody: any = {
        method: requestConfig.method || "DELETE",
        url: requestConfig.endpoint,
        json: requestConfig.json ?? requestConfig.data ?? formattedBatch,
        async: true,
        syncInfo: {
          syncId: processor.getSyncId(),
          modelName,
          changeIds: batch.map((c) => c.changeId),
        },
      };

      batchRequests.push({
        promise: this.restConnector.request(requestBody),
        batch,
        batchExtractFn,
      });
    }

    // Send all batches in parallel
    const sendStart = Date.now();
    const responses = await Promise.all(batchRequests.map((r) => r.promise));
    const sendTime = Date.now() - sendStart;
    console.info(`✅ Sent ${numBatches} batches in parallel in ${sendTime}ms`);

    // Register extract functions after all requests complete
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const { batchExtractFn, batch } = batchRequests[i];

      // Create default extract function if none provided
      const extractFn =
        batchExtractFn ||
        ((responseData: any) => {
          // Default extraction logic for batch deletes
          // For deletes, we just need to confirm the changeIds with their externalIds
          return batch.map((change: any) => ({
            changeId: change.changeId,
            externalId: String(change.externalId || change.id),
          }));
        });

      // Register batch extract function (only once per model)
      const responseSchema = connector.config.batchDelete?.responseSchema;
      if (response.httpRequestId) {
        processor.registerBatchExtractFunction(
          response.httpRequestId,
          extractFn,
          responseSchema
        );
      } else if (!processor.hasBatchExtractFunctionForModel(modelName)) {
        processor.registerBatchExtractFunctionByModel(
          modelName,
          extractFn,
          responseSchema
        );
      }
    }
  }

  /**
   * Process individual create/update/delete operations asynchronously using batch endpoint
   * This simulates batch behavior for APIs that don't have native batch support
   */
  private async processIndividualChangesAsync(
    connector: ModelConnector,
    delta: any,
    modelName: string,
    processor: ChangeProcessor
  ): Promise<void> {
    if (delta.operation === "CREATE" && connector.create) {
      console.info(
        `Processing ${delta.changes.length} CREATE changes for model ${modelName} (individual requests via batch endpoint)`
      );

      // Register extract function for individual CREATE requests if not already registered
      if (!processor.hasBatchExtractFunctionForModel(modelName)) {
        const createExtractFn = connector.config.create?.extract;
        const extractFn = (responseData: any, changeIds?: string[]) => {
          // For individual requests, each response corresponds to one change
          // changeIds will be provided by ChangeProcessor as second parameter
          const changeId =
            changeIds && changeIds.length > 0 ? changeIds[0] : "";

          if (createExtractFn) {
            // Use the model's extract function
            // The extract function expects the transformed response (after responseSchema validation and transform)
            // This matches the behavior of the sync create method
            try {
              // Validate response if schema provided
              let validated = responseData;
              const createConfig = connector.config.create!;
              if ((createConfig as any).responseSchema) {
                try {
                  validated = (createConfig as any).responseSchema.parse(
                    responseData
                  );
                } catch (error: any) {
                  // If validation fails but transform exists, try to proceed anyway
                  // The transform function might be able to handle the raw response structure
                  if ((createConfig as any).transform) {
                    console.warn(
                      `Response schema validation failed for model "${modelName}" create operation, but transform function exists. Proceeding with raw response. Validation errors: ${JSON.stringify(
                        error?.issues || [error],
                        null,
                        2
                      )}`
                    );
                    validated = responseData; // Use raw response
                  } else {
                    // No transform function, so validation is required
                    const errorMessage = error?.issues
                      ? JSON.stringify(error.issues, null, 2)
                      : String(error);
                    throw new Error(
                      `Response validation failed for model "${modelName}" create operation.\n` +
                        `Validation errors:\n${errorMessage}`
                    );
                  }
                }
              }

              // Apply transform function if provided
              const transformed = (createConfig as any).transform
                ? (createConfig as any).transform(validated)
                : validated;

              // Now call extract function with the transformed response
              const extracted = createExtractFn(transformed);
              // CREATE extract always returns externalId as string (required)
              if (!extracted.externalId) {
                throw new Error(
                  `Extract function returned missing externalId. Transformed response keys: ${Object.keys(
                    transformed || {}
                  ).join(", ")}`
                );
              }
              return [
                {
                  changeId,
                  externalId: String(extracted.externalId),
                  externalUpdatedAt: extracted.externalUpdatedAt ?? null,
                },
              ];
            } catch (error) {
              // Don't log here - let changeProcessor handle error logging
              // This prevents duplicate error messages
              throw error;
            }
          } else {
            // Default extraction - try common patterns for nested responses
            let externalId: string | null = null;
            let externalUpdatedAt: string | null = null;

            // Try direct properties first
            externalId = responseData?.id || responseData?.externalId || null;

            // Try nested structures (common patterns: { owner: { id } }, { data: { id } }, { result: { id } })
            if (!externalId && responseData) {
              externalId =
                responseData.owner?.id ||
                responseData.data?.id ||
                responseData.result?.id ||
                responseData.item?.id ||
                null;
            }

            externalUpdatedAt =
              responseData?.updatedAt ||
              responseData?.externalUpdatedAt ||
              responseData?.createdAt ||
              responseData?.owner?.updatedAt ||
              responseData?.owner?.createdAt ||
              responseData?.data?.updatedAt ||
              responseData?.data?.createdAt ||
              null;

            if (!externalId) {
              throw new Error(
                `Could not extract externalId from CREATE response. Response structure: ${JSON.stringify(
                  responseData,
                  null,
                  2
                )}`
              );
            }
            return [
              {
                changeId,
                externalId: String(externalId),
                externalUpdatedAt: externalUpdatedAt
                  ? String(externalUpdatedAt)
                  : null,
              },
            ];
          }
        };
        processor.registerBatchExtractFunctionByModel(modelName, extractFn);
      }

      const requests = delta.changes.map((change: any) => {
        const requestConfig = connector.config.create!.request(change.data);

        return {
          method: requestConfig.method || "POST",
          url: requestConfig.endpoint,
          json: requestConfig.json ?? requestConfig.data ?? change.data,
          syncInfo: {
            syncId: processor.getSyncId(),
            modelName,
            changeIds: [change.changeId],
          },
        };
      });

      // Send all requests in parallel using batch endpoint
      await this.restConnector.batchRequest({
        requests,
        syncId: processor.getSyncId(),
      });

      console.info(
        `Sent ${requests.length} parallel CREATE requests for model ${modelName}`
      );

      // Give responses a moment to start coming back before continuing
      // This helps when responses come back quickly via localhost proxy
      await new Promise((resolve) => setTimeout(resolve, 500));
    } else if (delta.operation === "UPDATE" && connector.update) {
      console.info(
        `Processing ${delta.changes.length} UPDATE changes for model ${modelName} (individual requests via batch endpoint)`
      );

      // Register extract function for individual UPDATE requests if not already registered
      if (!processor.hasBatchExtractFunctionForModel(modelName)) {
        const updateExtractFn = connector.config.update?.extract;
        const extractFn = (responseData: any, changeIds?: string[]) => {
          // For individual requests, each response corresponds to one change
          // changeIds will be provided by ChangeProcessor as second parameter
          const changeId =
            changeIds && changeIds.length > 0 ? changeIds[0] : "";

          if (updateExtractFn) {
            // Use the model's extract function
            const extracted = updateExtractFn(responseData);
            // For UPDATE, externalId is optional in extract function
            // We need to ensure we have a valid externalId string
            let externalId: string;
            if (extracted.externalId) {
              externalId = String(extracted.externalId);
            } else {
              // Fallback: try to extract from response or use placeholder
              // But we should always have externalId from the original change
              const fallbackId =
                responseData?.id || responseData?.externalId || null;
              if (!fallbackId) {
                throw new Error(
                  `Could not extract externalId from UPDATE response. Response keys: ${Object.keys(
                    responseData || {}
                  ).join(", ")}`
                );
              }
              externalId = String(fallbackId);
            }
            return [
              {
                changeId,
                externalId,
                externalUpdatedAt: extracted.externalUpdatedAt ?? null,
              },
            ];
          } else {
            // Default extraction
            const externalId =
              responseData?.id || responseData?.externalId || null;
            const externalUpdatedAt =
              responseData?.updatedAt ||
              responseData?.externalUpdatedAt ||
              null;
            if (!externalId) {
              throw new Error(
                `Could not extract externalId from UPDATE response. Response keys: ${Object.keys(
                  responseData || {}
                ).join(", ")}`
              );
            }
            return [
              {
                changeId,
                externalId: String(externalId),
                externalUpdatedAt: externalUpdatedAt
                  ? String(externalUpdatedAt)
                  : null,
              },
            ];
          }
        };
        processor.registerBatchExtractFunctionByModel(modelName, extractFn);
      }

      const requests = delta.changes.map((change: any) => {
        const requestConfig = connector.config.update!.request(
          change.externalId,
          change.data
        );

        return {
          method: requestConfig.method || "PUT",
          url: requestConfig.endpoint,
          json: requestConfig.json ?? requestConfig.data ?? change.data,
          syncInfo: {
            syncId: processor.getSyncId(),
            modelName,
            changeIds: [change.changeId],
          },
        };
      });

      // Send all requests in parallel using batch endpoint
      await this.restConnector.batchRequest({
        requests,
        syncId: processor.getSyncId(),
      });

      console.info(
        `Sent ${requests.length} parallel UPDATE requests for model ${modelName}`
      );

      // Give responses a moment to start coming back before continuing
      await new Promise((resolve) => setTimeout(resolve, 500));
    } else if (delta.operation === "DELETE" && connector.delete) {
      console.info(
        `Processing ${delta.changes.length} DELETE changes for model ${modelName} (individual requests via batch endpoint)`
      );

      // Register extract function for individual DELETE requests if not already registered
      if (!processor.hasBatchExtractFunctionForModel(modelName)) {
        // For DELETE operations, the externalId is typically in the URL path
        // The ChangeProcessor will extract it from the request URL
        const extractFn = (responseData: any, changeIds?: string[]) => {
          // For DELETE, the ChangeProcessor will extract externalId from the request URL
          // This is just a placeholder - the ChangeProcessor handles the actual extraction
          const changeId =
            changeIds && changeIds.length > 0 ? changeIds[0] : "";
          return [
            {
              changeId,
              externalId: "", // Will be extracted from request URL by ChangeProcessor
            },
          ];
        };
        processor.registerBatchExtractFunctionByModel(modelName, extractFn);
      }

      const requests = delta.changes.map((change: any) => {
        const requestConfig = connector.config.delete!.request(
          change.externalId
        );

        return {
          method: requestConfig.method || "DELETE",
          url: requestConfig.endpoint,
          json: requestConfig.json ?? requestConfig.data,
          syncInfo: {
            syncId: processor.getSyncId(),
            modelName,
            changeIds: [change.changeId],
          },
        };
      });

      // Send all requests in parallel using batch endpoint
      await this.restConnector.batchRequest({
        requests,
        syncId: processor.getSyncId(),
      });

      console.info(
        `Sent ${requests.length} parallel DELETE requests for model ${modelName}`
      );

      // Give responses a moment to start coming back before continuing
      await new Promise((resolve) => setTimeout(resolve, 500));
    } else {
      // No method available for this operation type
      throw new Error(
        `Cannot process ${
          delta.operation
        } delta for model "${modelName}": no ${delta.operation.toLowerCase()} method is configured`
      );
    }
  }

  /**
   * Process changes synchronously (fallback when async is disabled)
   */
  private async processSyncChanges(
    connector: ModelConnector,
    delta: any,
    modelName: string,
    syncId: string
  ): Promise<void> {
    if (delta.operation === "CREATE" && connector.create) {
      console.info(
        `Creating ${delta.changes.length} items for model ${modelName} (non-batch)`
      );
      const confirmations: Array<{
        changeId: string;
        externalId: string;
        externalUpdatedAt: string | null;
      }> = [];
      for (const change of delta.changes) {
        const created = await connector.create(change.data);
        const extracted = (
          connector.config.create?.extract
            ? connector.config.create.extract(created)
            : {
                externalId: (created as any).id as string,
                externalUpdatedAt: ((created as any).updatedAt ?? null) as any,
              }
        ) as any;
        confirmations.push({
          changeId: change.changeId,
          externalId: String(extracted.externalId ?? (created as any).id),
          externalUpdatedAt: extracted.externalUpdatedAt ?? null,
        });
      }
      await confirmChangeBatch({
        syncId,
        changes: confirmations,
        async: true,
      });
    } else if (delta.operation === "UPDATE" && connector.update) {
      console.info(
        `Updating ${delta.changes.length} items for model ${modelName} (non-batch)`
      );
      const confirmations: Array<{
        changeId: string;
        externalId: string;
        externalUpdatedAt: string | null;
      }> = [];
      for (const change of delta.changes) {
        const updated = await connector.update(change.externalId, change.data);
        const extracted = (
          connector.config.update?.extract
            ? connector.config.update.extract(updated)
            : {
                externalId: change.externalId,
                externalUpdatedAt: ((updated as any).updatedAt ?? null) as any,
              }
        ) as any;
        confirmations.push({
          changeId: change.changeId,
          externalId: String(extracted.externalId ?? change.externalId),
          externalUpdatedAt: extracted.externalUpdatedAt ?? null,
        });
      }
      await confirmChangeBatch({
        syncId,
        changes: confirmations,
        async: true,
      });
    } else if (delta.operation === "DELETE" && connector.delete) {
      console.info(
        `Deleting ${delta.changes.length} items for model ${modelName} (non-batch)`
      );
      const confirmations: Array<{
        changeId: string;
        externalId: string;
      }> = [];
      for (const change of delta.changes) {
        await connector.delete(change.externalId);
        confirmations.push({
          changeId: change.changeId,
          externalId: String(change.externalId),
        });
      }
      await confirmChangeBatch({
        syncId,
        changes: confirmations,
        async: true,
      });
    } else {
      // No method available for this operation type
      throw new Error(
        `Cannot process ${
          delta.operation
        } delta for model "${modelName}": no ${delta.operation.toLowerCase()} method is configured`
      );
    }
  }

  getRestConnector(): TRestConnector {
    return this.restConnector;
  }

  getCollection(): TCollection {
    return this.collection;
  }

  getModelConnector<M extends ExtractModels<TCollection>>(
    modelName: M
  ): ModelConnector<InferModelType<TCollection, M>> | undefined {
    return this.modelConnectors.get(modelName) as
      | ModelConnector<InferModelType<TCollection, M>>
      | undefined;
  }

  /**
   * Sync implementation with async writes for batch operations
   */
  private async syncWithAsyncWrites(
    type?: "FULL" | "INCREMENTAL" | "BASELINE"
  ): Promise<void> {
    let changeProcessor: ChangeProcessor | null = null;

    try {
      // Test/offline mode: perform a local sync without platform API calls
      try {
        if (process?.env?.NODE_ENV === "test") {
          for (const model of this.collection.models) {
            const connector = this.modelConnectors.get(model.name);
            if (!connector?.list) continue;
            const { items } = await connector.list({
              syncType: type || "FULL",
            });
            console.log(
              `Synced ${items?.length ?? 0} items for model ${model.name}`
            );
          }
          return;
        }
      } catch {}

      // High-level orchestration per sync-requirements
      const ctx = getCurrentContext();
      const syncId: string | undefined = (ctx as any)?.syncId;
      const managedUserId: string | undefined = (ctx as any)?.managedUserId;
      const app: string | undefined = (ctx as any)?.appName ?? undefined;
      const customApp: string | undefined =
        (ctx as any)?.customAppName ?? undefined;
      const runId: string | undefined = (ctx as any)?.runId ?? undefined;

      // Verify that syncId is present - sync should already be running
      console.log(
        `🔍 Sync context verification: syncId=${
          syncId ?? "MISSING"
        } managedUserId=${managedUserId ?? "MISSING"} runId=${
          runId ?? "MISSING"
        }`
      );

      if (!syncId) {
        const errorMsg =
          "❌ Missing syncId in context - sync should already be running when sync action is called";
        console.error(errorMsg);
        console.error("Context details:", {
          hasSyncId: !!syncId,
          hasManagedUserId: !!managedUserId,
          hasRunId: !!runId,
          contextKeys: Object.keys(ctx || {}),
        });
        throw new Error(errorMsg);
      }

      console.log(`✅ Sync verification passed: syncId=${syncId}`);

      // Set syncId into the log/context so subsequent platform calls can read it
      getLogCapture()?.setContext({ syncId } as any);

      // Initialize ChangeProcessor with syncId
      changeProcessor = new ChangeProcessor(syncId);

      // Require managed user for sync execution
      if (!managedUserId) {
        throw new Error("Missing managedUserId in context");
      }

      // Reset time budget for this run
      resetTimeLimit();

      // Determine models to sync from platform
      const collectionName = this.collection.name;
      const orderedModels = await getModels({ collectionName });
      let modelsToSync = orderedModels.map((m: any) => m.name);

      const sync = await getSync({ syncId });

      const currentModelName: string | undefined =
        sync.currentModel?.name ?? undefined;
      if (currentModelName) {
        const idx = modelsToSync.indexOf(currentModelName);
        if (idx >= 0) modelsToSync = modelsToSync.slice(idx);
      }

      let hadError = false;
      let errorMessage: string | undefined = undefined;
      let unrecoverableError = false;
      let canceledByServer = false;

      const isUnrecoverableSyncError = (err: any): boolean => {
        let status: number | undefined = undefined;
        if (err && typeof err === "object") {
          if (typeof (err as any).status === "number") {
            status = (err as any).status as number;
          } else if (
            (err as any).response &&
            typeof (err as any).response.status === "number"
          ) {
            status = (err as any).response.status as number;
          }
        }
        if (typeof status === "number") {
          return !isTemporaryHttpError(status);
        }
        // No status available: treat as temporary
        return false;
      };

      try {
        for (const modelName of modelsToSync) {
          const connector = this.modelConnectors.get(modelName);
          if (!connector) continue;

          await updateSync({ syncId, currentModelName: modelName });

          // Track if we've sent any HTTP requests during PUSH phase for this model
          let hasSentRequests = false;

          // Load latest sync state before starting model
          let state = await getSync({ syncId });
          const requestedDirection: "pull" | "push" | "bidirectional" =
            (state.requestedDirection as any) || "bidirectional";
          let currentDirection: "PULL" | "PUSH" | null =
            state.currentDirection ?? null;

          // Check model-level read/write restrictions
          const modelStatus = state.modelStatuses?.[modelName];
          const readOnly = modelStatus?.readOnly ?? false;
          const writeOnly = modelStatus?.writeOnly ?? false;

          // PULL phase remains synchronous
          // Skip PULL if model is writeOnly (can only write, not read)
          if (
            (requestedDirection === "pull" ||
              requestedDirection === "bidirectional") &&
            currentDirection !== "PUSH" &&
            !writeOnly
          ) {
            await updateSync({ syncId, currentDirection: "PULL" });
            console.info(`PULL phase started for model ${modelName}`);

            // ... existing PULL logic remains unchanged ...
            const listFn = connector.list;
            if (listFn) {
              let hasMore: boolean = true;
              let cursor: string | undefined =
                state.modelStatuses?.[modelName]?.cursor;
              let page: number | undefined =
                state.modelStatuses?.[modelName]?.page;
              let offset: number | undefined =
                state.modelStatuses?.[modelName]?.offset;
              let lastExternalId: string | undefined =
                state.modelStatuses?.[modelName]?.lastExternalId;
              let lastExternalUpdatedAt: string | undefined =
                state.modelStatuses?.[modelName]?.lastExternalUpdatedAt;
              const syncType = state.type || "FULL";

              // Track pending upserts and page timing
              const pendingUpserts: Promise<void>[] = [];
              let pageCount = 0;
              const pullStartTime = Date.now();

              while (hasMore) {
                if (isTimeLimitExceeded()) {
                  // Wait for pending upserts before continuing
                  console.warn(
                    `⚠️ [DEBUG] Time limit exceeded in pull phase, waiting for ${pendingUpserts.length} pending upserts`
                  );
                  await Promise.all(pendingUpserts);
                  console.warn(
                    `⚠️ [DEBUG] Pending upserts complete, calling continueSync for syncId=${syncId}`
                  );
                  await continueSync(syncId);
                  console.info(
                    "⏱️ Time limit reached, sync will continue in next run"
                  );
                  return;
                }

                const params: any = {
                  cursor,
                  page,
                  offset,
                  lastExternalId,
                  lastExternalUpdatedAt,
                  syncType,
                };

                const fetchStart = Date.now();
                const { items, pagination } = await listFn(params);
                const fetchTime = Date.now() - fetchStart;
                pageCount++;

                console.info(
                  `📄 Page ${pageCount}: fetched ${
                    items?.length ?? 0
                  } items in ${fetchTime}ms`
                );

                if (!items || items.length === 0) {
                  break;
                }

                const objects = items.map((it) => ({
                  externalId: String(it.externalId),
                  externalUpdatedAt: it.externalUpdatedAt
                    ? String(it.externalUpdatedAt)
                    : null,
                  data: it.data,
                }));

                // Fire-and-forget upsert - track promise for error handling
                const upsertPromise = upsertObjectBatch({
                  collectionName,
                  syncId,
                  modelName,
                  app,
                  customApp,
                  objects,
                  cursor: pagination?.cursor,
                  page: pagination?.page,
                  offset: pagination?.offset,
                  async: true,
                }).catch((error) => {
                  console.error(
                    `Failed to upsert batch for ${modelName}:`,
                    error
                  );
                  throw error;
                });

                pendingUpserts.push(upsertPromise);

                // Update watermarks (server tracks actual success)
                const last = objects[objects.length - 1];
                lastExternalId = last.externalId;
                lastExternalUpdatedAt = last.externalUpdatedAt || undefined;
                cursor = pagination?.cursor;
                page = pagination?.page;
                offset = pagination?.offset;
                hasMore = !!pagination?.hasMore;

                // Every 10 pages, checkpoint
                if (pendingUpserts.length >= 10) {
                  const checkpointStart = Date.now();
                  await Promise.all(pendingUpserts);
                  const checkpointTime = Date.now() - checkpointStart;
                  const totalTime = Date.now() - pullStartTime;
                  const avgPerPage = totalTime / pageCount;
                  console.info(
                    `✅ Checkpoint at page ${pageCount}: ${
                      pendingUpserts.length
                    } upserts completed in ${checkpointTime}ms (avg ${avgPerPage.toFixed(
                      0
                    )}ms/page)`
                  );
                  pendingUpserts.length = 0;
                }
              }

              // Wait for any remaining upserts
              if (pendingUpserts.length > 0) {
                const finalStart = Date.now();
                await Promise.all(pendingUpserts);
                const finalTime = Date.now() - finalStart;
                console.info(
                  `✅ Final ${pendingUpserts.length} upserts completed in ${finalTime}ms`
                );
              }

              const totalPullTime = Date.now() - pullStartTime;
              console.info(
                `📊 PULL complete: ${pageCount} pages in ${(
                  totalPullTime / 1000
                ).toFixed(1)}s (avg ${(totalPullTime / pageCount).toFixed(
                  0
                )}ms/page)`
              );
            }
          } else if (writeOnly) {
            console.info(
              `⏭️  PULL phase skipped for model ${modelName} (writeOnly=true)`
            );
          }

          // PUSH phase with async HTTP
          // Skip PUSH if model is readOnly (can only read, not write)
          if (
            (requestedDirection === "push" ||
              requestedDirection === "bidirectional") &&
            !readOnly
          ) {
            await updateSync({ syncId, currentDirection: "PUSH" });
            console.info(`PUSH phase started for model ${modelName}`);

            let pushDeltaCount = 0;
            const pushStartTime = Date.now();

            while (true) {
              if (isTimeLimitExceeded()) {
                // Time limit reached - continue on next run
                // Unconfirmed changes will be processed on next run
                console.warn(
                  `⚠️ [DEBUG] Time limit exceeded in push phase, calling continueSync for syncId=${syncId}`
                );
                await continueSync(syncId);
                console.info(
                  "⏱️  Time limit reached, continuing sync on next run (unconfirmed changes will be handled on next run)..."
                );
                return;
              }

              const deltaStart = Date.now();
              const delta = await retrieveDelta({
                collectionName,
                syncId,
                modelName,
                limit: 1000, // Fetch larger batches for efficiency
              });
              const deltaTime = Date.now() - deltaStart;
              pushDeltaCount++;

              console.info(
                `📋 Delta ${pushDeltaCount}: ${
                  delta.operation ?? "null"
                } operation, ${
                  delta.changes?.length ?? 0
                } changes in ${deltaTime}ms`
              );

              if (!delta.changes || delta.changes.length === 0) {
                const totalPushTime = Date.now() - pushStartTime;
                console.info(
                  `📊 PUSH complete: ${pushDeltaCount} delta fetches in ${(
                    totalPushTime / 1000
                  ).toFixed(1)}s`
                );
                break;
              }

              // Process changes with async HTTP
              if (connector.batchCreate && delta.operation === "CREATE") {
                await this.processBatchCreateAsync(
                  connector,
                  delta.changes,
                  modelName,
                  changeProcessor
                );
                hasSentRequests = true;
              } else if (
                connector.batchUpdate &&
                delta.operation === "UPDATE"
              ) {
                await this.processBatchUpdateAsync(
                  connector,
                  delta.changes,
                  modelName,
                  changeProcessor
                );
                hasSentRequests = true;
              } else if (
                connector.batchDelete &&
                delta.operation === "DELETE"
              ) {
                await this.processBatchDeleteAsync(
                  connector,
                  delta.changes,
                  modelName,
                  changeProcessor
                );
                hasSentRequests = true;
              } else {
                // Process individual operations asynchronously
                // Validate that the required method exists before processing
                if (delta.operation === "CREATE" && !connector.create) {
                  throw new Error(
                    `Cannot process CREATE delta for model "${modelName}": create method is not configured`
                  );
                } else if (delta.operation === "UPDATE" && !connector.update) {
                  throw new Error(
                    `Cannot process UPDATE delta for model "${modelName}": update method is not configured`
                  );
                } else if (delta.operation === "DELETE" && !connector.delete) {
                  throw new Error(
                    `Cannot process DELETE delta for model "${modelName}": delete method is not configured`
                  );
                }
                await this.processIndividualChangesAsync(
                  connector,
                  delta,
                  modelName,
                  changeProcessor
                );
                hasSentRequests = true;
              }

              // Track changes processed
              changeProcessor.addChangesProcessed(delta.changes.length);

              // Process confirmations every 5000 changes (balances even progress with performance)
              if (changeProcessor.shouldProcessConfirmations(5000)) {
                try {
                  await changeProcessor.processUnconfirmedChanges();
                  changeProcessor.resetConfirmationCounter();
                } catch (error) {
                  console.warn("Error processing unconfirmed changes:", error);
                }
              }
            }
          } else if (readOnly) {
            console.info(
              `⏭️  PUSH phase skipped for model ${modelName} (readOnly=true)`
            );
          }

          // Clear direction after model finishes
          await updateSync({ syncId, currentDirection: null });

          // Process any pending confirmations for this model before moving to next model
          // This helps prevent delta locks when moving between models
          // Poll until all writes are confirmed or timeout
          if (hasSentRequests) {
            console.info(
              `🔄 Processing confirmations for model ${modelName} before moving to next model...`
            );

            // Wait longer initially if we sent requests, as platform may need time to queue them
            // This is especially important for localhost proxy where requests may be delayed
            await new Promise((resolve) => setTimeout(resolve, 3000));

            let confirmationAttempts = 0;
            const maxConfirmationAttempts = 40; // Wait up to ~40 seconds for responses
            let consecutiveZeroCounts = 0; // Track consecutive zero counts

            while (confirmationAttempts < maxConfirmationAttempts) {
              const result = await changeProcessor.processUnconfirmedChanges();

              // If no pending writes and no changes, check if we've seen zeros consistently
              // This handles the case where requests haven't been queued yet
              if (result.pendingWritesCount === 0 && !result.hasChanges) {
                consecutiveZeroCounts++;
                // If we've seen zero for 3 consecutive checks, we're probably done
                // But if it's early (first few attempts), keep checking in case requests are slow to appear
                if (consecutiveZeroCounts >= 3 && confirmationAttempts >= 5) {
                  console.info(
                    `✅ All confirmations complete for model ${modelName} after ${
                      confirmationAttempts + 1
                    } attempts`
                  );
                  break;
                }
              } else {
                consecutiveZeroCounts = 0; // Reset counter if we see any activity
              }

              if (result.pendingWritesCount > 0) {
                console.info(
                  `⏳ ${
                    result.pendingWritesCount
                  } writes still pending for model ${modelName}, waiting... (attempt ${
                    confirmationAttempts + 1
                  }/${maxConfirmationAttempts})`
                );
              } else if (confirmationAttempts < 5) {
                // Log early attempts even if zero, to show we're waiting for requests to appear
                console.info(
                  `⏳ Waiting for HTTP requests to appear for model ${modelName}... (attempt ${
                    confirmationAttempts + 1
                  }/${maxConfirmationAttempts})`
                );
              }

              confirmationAttempts++;

              // Wait before next attempt (exponential backoff, but faster initial checks)
              const waitTime =
                confirmationAttempts <= 5
                  ? 1000 // Check every second for first 5 attempts
                  : Math.min(1000 * (confirmationAttempts - 5), 2000); // Then exponential backoff
              await new Promise((resolve) => setTimeout(resolve, waitTime));
            }

            if (confirmationAttempts >= maxConfirmationAttempts) {
              console.warn(
                `⚠️  Confirmation timeout for model ${modelName} - ${maxConfirmationAttempts} attempts reached. Writes may be confirmed in final pass.`
              );
            }
          }
        }

        // Final confirmation passes - poll until no pending writes remain
        console.info("🔄 Processing remaining async writes...");
        let passCount = 0;
        while (true) {
          passCount++;
          try {
            const result = await changeProcessor.processUnconfirmedChanges();

            if (!result.hasChanges && result.pendingWritesCount === 0) {
              // No changes and no pending writes - we're done!
              console.info(
                `✅ All confirmations complete after ${passCount} passes`
              );
              break;
            }

            if (result.pendingWritesCount > 0) {
              console.info(
                `⏳ ${result.pendingWritesCount} writes still pending, waiting...`
              );
            }

            // Wait a bit for any in-flight async writes to complete
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (error) {
            console.warn(`Error in confirmation pass ${passCount}:`, error);
            break;
          }
        }

        console.info("✅ All models synced");
      } catch (e: any) {
        if (e === "RERUN") throw e;
        if (e === "SKIPPED") {
          console.warn(
            "Sync start was skipped by server policy; exiting cleanly"
          );
          return;
        }

        let status: number | undefined = undefined;
        if (e && typeof e === "object") {
          if (typeof (e as any).status === "number") {
            status = (e as any).status as number;
          } else if (
            (e as any).response &&
            typeof (e as any).response.status === "number"
          ) {
            status = (e as any).response.status as number;
          }
        }

        if (status === 409) {
          canceledByServer = true;
          hadError = true;
          errorMessage = e instanceof Error ? e.message : String(e);
          unrecoverableError = isUnrecoverableSyncError(e);
          // Don't log validation errors here - they'll be logged by the run handler
          if (
            !(e instanceof ValidationError || (e as any).__isValidationError)
          ) {
            console.error(
              `Sync encountered an error: ${
                e instanceof Error ? e.message : String(e)
              }`
            );
          }
        } else {
          hadError = true;
          errorMessage = e instanceof Error ? e.message : String(e);
          unrecoverableError = isUnrecoverableSyncError(e);
          // Don't log validation errors here - they'll be logged by the run handler
          if (
            !(e instanceof ValidationError || (e as any).__isValidationError)
          ) {
            console.error(
              `Sync encountered an error: ${
                e instanceof Error ? e.message : String(e)
              }`
            );
          }
        }
      } finally {
        // Cleanup is handled in waitForPendingChanges
      }

      // Finish the sync
      if (!canceledByServer) {
        try {
          console.info(
            `Finishing sync ${syncId}${hadError ? " (with error)" : ""} force=${
              hadError && unrecoverableError
            }`
          );
          if (hadError) {
            try {
              await finishSync(syncId, {
                error: errorMessage,
                force: true,
              });
            } catch (finishErr: any) {
              console.warn(`finishSync(force=true) failed:`, finishErr);
            }
          } else {
            await finishSync(syncId);
          }
          console.info(`Finished sync ${syncId}`);
        } catch (e) {
          console.warn(`Failed to finish sync ${syncId}:`, e);
          hadError = true;
          errorMessage =
            (e instanceof Error ? e.message : String(e)) ||
            errorMessage ||
            "Failed to finish sync";
        }
      }

      if (hadError) {
        throw new Error(errorMessage || "Sync failed");
      }
    } finally {
      // Cleanup is handled in waitForPendingChanges
    }
  }

  async sync(type?: "FULL" | "INCREMENTAL" | "BASELINE"): Promise<void> {
    console.info("Using async writes for batch operations");
    return this.syncWithAsyncWrites(type);
  }

  /**
   * Perform PULL phase for a single model
   */
  private async performPullForModel(props: {
    modelName: string;
    connector: ModelConnector;
    syncId: string;
    collectionName: string;
    app?: string;
    customApp?: string;
    state: any;
  }): Promise<void> {
    const {
      modelName,
      connector,
      syncId,
      collectionName,
      app,
      customApp,
      state,
    } = props;

    const syncType: "FULL" | "INCREMENTAL" | "BASELINE" = state.type || "FULL";

    // Read model watermarks
    let cursor: string | undefined;
    if (state.lastBatch?.modelName === modelName && state.lastBatch?.cursor) {
      cursor = state.lastBatch.cursor;
    } else if (state.modelStatuses?.[modelName]?.cursor) {
      cursor = state.modelStatuses[modelName].cursor;
    }
    let lastExternalId: string | undefined =
      state.modelStatuses?.[modelName]?.lastExternalId ?? undefined;
    let lastExternalUpdatedAt: string | undefined =
      state.modelStatuses?.[modelName]?.lastExternalUpdatedAt ?? undefined;
    let page: number | undefined =
      typeof state.modelStatuses?.[modelName]?.page === "number"
        ? state.modelStatuses[modelName].page
        : typeof state.page === "number"
        ? state.page
        : undefined;
    let offset: number | undefined =
      typeof state.modelStatuses?.[modelName]?.offset === "number"
        ? state.modelStatuses[modelName].offset
        : typeof state.offset === "number"
        ? state.offset
        : undefined;

    console.info(`PULL phase started for model ${modelName}`);
    const listFn = connector.list;
    if (!listFn) {
      console.info(
        `No list function configured for model ${modelName}, skipping PULL`
      );
      return;
    }

    // Build initial params
    const buildParams = () => {
      const params: any = {};
      if (cursor) params.cursor = cursor;
      if (typeof page === "number") params.page = page;
      if (typeof offset === "number") params.offset = offset;
      if (lastExternalId) params.lastExternalId = lastExternalId;
      if (lastExternalUpdatedAt)
        params.lastExternalUpdatedAt = lastExternalUpdatedAt;
      params.syncType = syncType;
      return params;
    };

    // Track pending upserts for error handling
    const pendingUpserts: Promise<void>[] = [];
    let hasMore: boolean = true;
    let pageCount = 0;
    const pullStartTime = Date.now();

    while (hasMore) {
      if (isTimeLimitExceeded()) {
        // Wait for pending upserts before continuing
        console.warn(
          `⚠️ [DEBUG] Time limit exceeded in pull phase, waiting for ${pendingUpserts.length} pending upserts`
        );
        await Promise.all(pendingUpserts);
        console.warn(
          `⚠️ [DEBUG] Pending upserts complete, calling continueSync for syncId=${syncId}`
        );
        await continueSync(syncId);
        console.info("⏱️ Time limit reached, sync will continue in next run");
        return;
      }

      const fetchStart = Date.now();
      // Fetch next page
      const { items, pagination } = await listFn(buildParams());
      const fetchTime = Date.now() - fetchStart;
      pageCount++;

      console.info(
        `📄 Page ${pageCount}: fetched ${
          items?.length ?? 0
        } items in ${fetchTime}ms`
      );

      if (!items || items.length === 0) {
        break;
      }

      // Update pagination state
      cursor = pagination?.cursor;
      if (typeof pagination?.page === "number") page = pagination.page;
      if (typeof pagination?.offset === "number") offset = pagination.offset;
      hasMore = !!pagination?.hasMore;

      // Process current page
      const objects = items.map((it) => ({
        externalId: String(it.externalId),
        externalUpdatedAt: it.externalUpdatedAt
          ? String(it.externalUpdatedAt)
          : null,
        data: it.data,
      }));

      // Fire-and-forget upsert (don't await) - track promise for error handling
      const upsertPromise = upsertObjectBatch({
        collectionName,
        syncId,
        modelName,
        app,
        customApp,
        objects,
        cursor: pagination?.cursor,
        page:
          typeof pagination?.page === "number" ? pagination.page : undefined,
        offset:
          typeof pagination?.offset === "number"
            ? pagination.offset
            : undefined,
        async: true,
      }).catch((error) => {
        console.error(`Failed to upsert batch for ${modelName}:`, error);
        throw error; // Re-throw to fail the sync
      });

      pendingUpserts.push(upsertPromise);

      // Update watermarks (server will track actual success)
      const last = objects[objects.length - 1];
      lastExternalId = last.externalId;
      lastExternalUpdatedAt = last.externalUpdatedAt || undefined;

      // Every 10 pages, await all pending to prevent unbounded growth and catch errors
      if (pendingUpserts.length >= 10) {
        const checkpointStart = Date.now();
        await Promise.all(pendingUpserts);
        const checkpointTime = Date.now() - checkpointStart;
        const totalTime = Date.now() - pullStartTime;
        const avgPerPage = totalTime / pageCount;
        console.info(
          `✅ Checkpoint at page ${pageCount}: ${
            pendingUpserts.length
          } upserts completed in ${checkpointTime}ms (avg ${avgPerPage.toFixed(
            0
          )}ms/page)`
        );
        pendingUpserts.length = 0;
      }
    }

    // Wait for any remaining upserts
    if (pendingUpserts.length > 0) {
      const finalStart = Date.now();
      await Promise.all(pendingUpserts);
      const finalTime = Date.now() - finalStart;
      console.info(
        `✅ Final ${pendingUpserts.length} upserts completed in ${finalTime}ms`
      );
    }

    const totalPullTime = Date.now() - pullStartTime;
    console.info(
      `📊 PULL complete: ${pageCount} pages in ${(totalPullTime / 1000).toFixed(
        1
      )}s (avg ${(totalPullTime / pageCount).toFixed(0)}ms/page)`
    );
  }

  /**
   * Perform PUSH phase for a single model
   */
  private async performPushForModel(props: {
    modelName: string;
    connector: ModelConnector;
    syncId: string;
    collectionName: string;
  }): Promise<void> {
    const { modelName, connector, syncId, collectionName } = props;

    console.info(`PUSH phase started for model ${modelName}`);

    while (true) {
      if (isTimeLimitExceeded()) {
        console.warn(
          `⚠️ [DEBUG] Time limit exceeded in legacy push, calling continueSync for syncId=${syncId}`
        );
        await continueSync(syncId);
        console.info("⏱️ Time limit reached, sync will continue in next run");
        return;
      }

      const delta = await retrieveDelta({
        collectionName,
        syncId,
        modelName,
      });
      console.info(
        `Delta received for model ${modelName}: operation=${
          (delta as any).operation
        } count=${(delta as any).changes?.length ?? 0}`
      );

      if (!delta.changes || delta.changes.length === 0) break;

      if (connector.batchCreate && delta.operation === "CREATE") {
        console.info(
          `Creating ${delta.changes.length} items for model ${modelName} (batch)`
        );
        const payloadType =
          connector.config.batchCreate?.payloadType ??
          (connector.config.batchCreate?.extract ? "changes" : "items");
        const batchInput =
          payloadType === "changes"
            ? delta.changes.map((change: any) => {
                const payload =
                  change.data ?? change.obj ?? change.payload ?? null;
                return {
                  ...change,
                  data: payload,
                  obj: change.obj ?? payload,
                };
              })
            : delta.changes.map((c: any) => c.data);

        const created = await connector.batchCreate(batchInput as any);

        let changesToConfirm: Array<{
          changeId: string;
          externalId: string;
          externalUpdatedAt: string | null;
        }> = [];

        const looksLikeConfirmations =
          Array.isArray(created) &&
          created.length > 0 &&
          created.every(
            (item: any) =>
              item &&
              typeof item === "object" &&
              "changeId" in item &&
              ("externalId" in item || "externalUpdatedAt" in item)
          );

        if (looksLikeConfirmations) {
          const changeById = new Map(
            delta.changes.map((change: any) => [change.changeId, change])
          );
          changesToConfirm = (created as any).map((item: any) => {
            const change = changeById.get(String(item.changeId));
            const externalIdCandidate =
              item.externalId ??
              change?.externalId ??
              change?.data?.id ??
              change?.data?.externalId;
            if (
              externalIdCandidate === undefined ||
              externalIdCandidate === null
            ) {
              throw new Error(
                `Batch create extract did not provide externalId for change ${item.changeId}`
              );
            }
            return {
              changeId: String(item.changeId),
              externalId: String(externalIdCandidate),
              externalUpdatedAt:
                item.externalUpdatedAt === undefined ||
                item.externalUpdatedAt === null
                  ? null
                  : String(item.externalUpdatedAt),
            };
          });
        } else {
          const createdArray = Array.isArray(created) ? created : [];
          changesToConfirm = createdArray.map((item: any, i: number) => {
            const change = delta.changes[i];
            const externalId = (
              connector.config.create?.extract
                ? connector.config.create.extract(item)
                : {
                    externalId: (item.id ?? item.externalId) as string,
                    externalUpdatedAt: (item.updatedAt ?? null) as any,
                  }
            ) as any;
            return {
              changeId: change.changeId,
              externalId: String(
                externalId.externalId ?? externalId.id ?? item.id
              ),
              externalUpdatedAt: externalId.externalUpdatedAt ?? null,
            };
          });
        }

        try {
          console.debug(
            `Confirming ${changesToConfirm.length} CREATE (batch) changes for model ${modelName}:`,
            changesToConfirm.map((c) => ({
              changeId: c.changeId,
              externalId: c.externalId,
              externalUpdatedAt: c.externalUpdatedAt,
            }))
          );
        } catch {}
        await confirmChangeBatch({
          syncId,
          changes: changesToConfirm,
          async: true,
        });
        console.info(
          `Confirmed ${changesToConfirm.length} CREATE changes for model ${modelName}`
        );
      } else if (connector.batchUpdate && delta.operation === "UPDATE") {
        console.info(
          `Updating ${delta.changes.length} items for model ${modelName} (batch)`
        );
        const payloadType =
          connector.config.batchUpdate?.payloadType ??
          (connector.config.batchUpdate?.extract ? "changes" : "items");
        const batchInput =
          payloadType === "changes"
            ? delta.changes.map((change: any) => {
                const payload =
                  change.data ?? change.obj ?? change.payload ?? {};
                const externalId = String(change.externalId ?? change.id);
                return {
                  ...change,
                  externalId,
                  id: change.id ?? externalId,
                  data: payload,
                  obj: change.obj ?? payload,
                } as BatchUpdateChange<any>;
              })
            : delta.changes.map((c: any) => ({
                id: c.externalId,
                data: c.data,
              }));
        const updated = await connector.batchUpdate(batchInput as any);

        let changesToConfirm: Array<{
          changeId: string;
          externalId: string;
          externalUpdatedAt: string | null;
        }> = [];

        const looksLikeConfirmations =
          Array.isArray(updated) &&
          updated.length > 0 &&
          updated.every(
            (item: any) =>
              item &&
              typeof item === "object" &&
              "changeId" in item &&
              ("externalId" in item || "externalUpdatedAt" in item)
          );

        if (looksLikeConfirmations) {
          const changeById = new Map(
            delta.changes.map((change: any) => [change.changeId, change])
          );
          changesToConfirm = (updated as any).map((item: any) => {
            const change = changeById.get(String(item.changeId));
            const externalIdCandidate =
              item.externalId ??
              change?.externalId ??
              change?.data?.id ??
              change?.data?.externalId;
            if (
              externalIdCandidate === undefined ||
              externalIdCandidate === null
            ) {
              throw new Error(
                `Batch update extract did not provide externalId for change ${item.changeId}`
              );
            }
            return {
              changeId: String(item.changeId),
              externalId: String(externalIdCandidate),
              externalUpdatedAt:
                item.externalUpdatedAt === undefined ||
                item.externalUpdatedAt === null
                  ? null
                  : String(item.externalUpdatedAt),
            };
          });
        } else {
          const updatedArray = Array.isArray(updated) ? updated : [];
          changesToConfirm = updatedArray.map((item: any, i: number) => {
            const change = delta.changes[i];
            const extracted = (
              connector.config.update?.extract
                ? connector.config.update.extract(item)
                : {
                    externalId: change.externalId,
                    externalUpdatedAt: (item?.updatedAt ?? null) as any,
                  }
            ) as any;
            return {
              changeId: change.changeId,
              externalId: String(extracted.externalId ?? change.externalId),
              externalUpdatedAt: extracted.externalUpdatedAt ?? null,
            };
          });
        }

        try {
          console.debug(
            `Confirming ${changesToConfirm.length} UPDATE (batch) changes for model ${modelName}:`,
            changesToConfirm.map((c) => ({
              changeId: c.changeId,
              externalId: c.externalId,
              externalUpdatedAt: c.externalUpdatedAt,
            }))
          );
        } catch {}
        await confirmChangeBatch({
          syncId,
          changes: changesToConfirm,
          async: true,
        });
        console.info(
          `Confirmed ${changesToConfirm.length} UPDATE changes for model ${modelName}`
        );
      } else if (connector.batchDelete && delta.operation === "DELETE") {
        console.info(
          `Deleting ${delta.changes.length} items for model ${modelName} (batch)`
        );
        const payloadType =
          connector.config.batchDelete?.payloadType ??
          (connector.config.batchDelete?.extract ? "changes" : "ids");
        const batchInput =
          payloadType === "changes"
            ? delta.changes.map((change: any) => ({
                ...change,
                externalId: String(change.externalId ?? change.id),
                id: change.id ?? change.externalId,
              }))
            : delta.changes.map((c: any) => ({
                changeId: c.changeId,
                externalId: String(c.externalId),
              }));
        const deleted = await connector.batchDelete(batchInput as any);
        let changesToConfirm: Array<{
          changeId: string;
          externalId: string;
        }> = [];

        const looksLikeConfirmations =
          Array.isArray(deleted) &&
          deleted.length > 0 &&
          deleted.every(
            (item: any) =>
              item &&
              typeof item === "object" &&
              "changeId" in item &&
              ("externalId" in item || "externalUpdatedAt" in item)
          );

        if (looksLikeConfirmations) {
          const changeById = new Map(
            delta.changes.map((change: any) => [change.changeId, change])
          );
          changesToConfirm = (deleted as any).map((item: any) => {
            const change = changeById.get(String(item.changeId));
            const externalIdCandidate =
              item.externalId ?? change?.externalId ?? change?.id;
            if (
              externalIdCandidate === undefined ||
              externalIdCandidate === null
            ) {
              throw new Error(
                `Batch delete extract did not provide externalId for change ${item.changeId}`
              );
            }
            return {
              changeId: String(item.changeId),
              externalId: String(externalIdCandidate),
            };
          });
        } else {
          changesToConfirm = delta.changes.map((c: any) => ({
            changeId: c.changeId,
            externalId: String(c.externalId),
          }));
        }

        await confirmChangeBatch({
          syncId,
          changes: changesToConfirm,
          async: true,
        });
        console.info(
          `Confirmed ${changesToConfirm.length} DELETE changes for model ${modelName}`
        );
      } else {
        // Fallback to non-batch
        if (delta.operation === "CREATE" && connector.create) {
          console.info(
            `Creating ${delta.changes.length} items for model ${modelName} (non-batch)`
          );
          const confirmations: Array<{
            changeId: string;
            externalId: string;
            externalUpdatedAt: string | null;
          }> = [];
          for (const change of delta.changes) {
            const created = await connector.create(change.data);
            const extracted = (
              connector.config.create?.extract
                ? connector.config.create.extract(created)
                : {
                    externalId: (created as any).id as string,
                    externalUpdatedAt: ((created as any).updatedAt ??
                      null) as any,
                  }
            ) as any;
            confirmations.push({
              changeId: change.changeId,
              externalId: String(extracted.externalId ?? (created as any).id),
              externalUpdatedAt: extracted.externalUpdatedAt ?? null,
            });
            try {
              console.debug(
                `Confirming CREATE (non-batch) change for model ${modelName}:`,
                {
                  changeId: change.changeId,
                  externalId: String(
                    extracted.externalId ?? (created as any).id
                  ),
                  externalUpdatedAt: extracted.externalUpdatedAt ?? null,
                }
              );
            } catch {}
          }
          await confirmChangeBatch({
            syncId,
            changes: confirmations,
            async: true,
          });
          console.info(
            `Confirmed ${confirmations.length} CREATE changes for model ${modelName}`
          );
        } else if (delta.operation === "UPDATE" && connector.update) {
          console.info(
            `Updating ${delta.changes.length} items for model ${modelName} (non-batch)`
          );
          const confirmations: Array<{
            changeId: string;
            externalId: string;
            externalUpdatedAt: string | null;
          }> = [];
          for (const change of delta.changes) {
            const updated = await connector.update(
              change.externalId,
              change.data
            );
            const extracted = (
              connector.config.update?.extract
                ? connector.config.update.extract(updated)
                : {
                    externalId: change.externalId,
                    externalUpdatedAt: ((updated as any).updatedAt ??
                      null) as any,
                  }
            ) as any;
            confirmations.push({
              changeId: change.changeId,
              externalId: String(extracted.externalId ?? change.externalId),
              externalUpdatedAt: extracted.externalUpdatedAt ?? null,
            });
            try {
              console.debug(
                `Confirming UPDATE (non-batch) change for model ${modelName}:`,
                {
                  changeId: change.changeId,
                  externalId: String(extracted.externalId ?? change.externalId),
                  externalUpdatedAt: extracted.externalUpdatedAt ?? null,
                }
              );
            } catch {}
          }
          await confirmChangeBatch({
            syncId,
            changes: confirmations,
            async: true,
          });
          console.info(
            `Confirmed ${confirmations.length} UPDATE changes for model ${modelName}`
          );
        } else if (delta.operation === "DELETE" && connector.delete) {
          console.info(
            `Deleting ${delta.changes.length} items for model ${modelName} (non-batch)`
          );
          const confirmations: Array<{
            changeId: string;
            externalId: string;
          }> = [];
          for (const change of delta.changes) {
            await connector.delete(change.externalId);
            confirmations.push({
              changeId: change.changeId,
              externalId: String(change.externalId),
            });
          }
          await confirmChangeBatch({
            syncId,
            changes: confirmations,
            async: true,
          });
          console.info(
            `Confirmed ${confirmations.length} DELETE changes for model ${modelName}`
          );
        } else {
          // No method available for this operation type
          throw new Error(
            `Cannot process ${
              delta.operation
            } delta for model "${modelName}": no ${delta.operation.toLowerCase()} method is configured`
          );
        }
      }
    }
  }
}

export interface CreateSyncConnectorFn<
  TRestConnector extends RestConnector,
  TCollection extends Collection
> {
  (
    restConnector: TRestConnector,
    collection: TCollection
  ): SyncConnectorBuilder<TRestConnector, TCollection>;
  from: (
    source:
      | SyncConnectorBuilder<TRestConnector, TCollection>
      | SyncConnector<TRestConnector, TCollection>
  ) => SyncConnectorBuilder<TRestConnector, TCollection>;
}

export function createSyncConnector<
  RC extends RestConnector,
  C extends Collection
>(restConnector: RC, collection: C): SyncConnectorBuilder<RC, C> {
  return new SyncConnectorBuilder<RC, C>(restConnector, collection);
}

createSyncConnector.from = (source: any) => SyncConnectorBuilder.from(source);

// Type-safe config factory for better inference
export function createListConfig<TModel, TResponse>(config: {
  request: (params: ListParams) => {
    endpoint: string;
    method?: "GET" | "POST";
    params?: Record<string, any>;
    data?: any;
  };
  responseSchema: z.ZodType<TResponse>;
  pagination?: (response: any) => {
    cursor?: string | null;
    page?: number | null;
    offset?: number | null;
    hasMore: boolean;
  };
  transform?: (response: TResponse) => Array<SyncObject<TModel>>;
}): ListConfig<TModel, TResponse> {
  return config;
}

// Type-safe create config factory for better inference
export function createCreateConfig<TModel>(config: {
  request: (data: TModel) => {
    endpoint: string;
    method?: "POST" | "PUT";
    data?: any;
  };
  responseSchema?: z.ZodType<TModel>;
  transform?: (response: any) => TModel;
  extract: (item: TModel) => {
    externalId: string;
    externalUpdatedAt: string | null;
  };
}): CreateConfig<TModel> {
  return config as CreateConfig<TModel>;
}

// Type-safe update config factory for better inference
export function createUpdateConfig<TModel>(config: {
  request: (
    id: string,
    data: Partial<TModel>
  ) => {
    endpoint: string;
    method?: "PUT" | "PATCH" | "POST";
    data?: any;
  };
  responseSchema?: z.ZodType<TModel>;
  transform?: (response: any) => TModel;
  extract: (item: TModel) => {
    externalId?: string;
    externalUpdatedAt: string | null;
  };
}): UpdateConfig<TModel> {
  return config as UpdateConfig<TModel>;
}

// Type-safe delete config factory
export function createDeleteConfig(config: {
  request: (id: string) => {
    endpoint: string;
    method?: "DELETE" | "POST";
    data?: any;
  };
}): DeleteConfig {
  return config;
}
