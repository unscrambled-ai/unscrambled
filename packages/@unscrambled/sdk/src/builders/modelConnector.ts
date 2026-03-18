import { z } from "zod";
import type { RestConnector } from "../connectors/RestConnector";
import type { Model, InferModelData } from "../types";
import type {
  ListConfig,
  CreateConfig,
  UpdateConfig,
  DeleteConfig,
  ModelConnectorConfig,
  BatchCreateOperationConfig,
  BatchCreateChange,
  BatchUpdateOperationConfig,
  BatchDeleteOperationConfig,
  ListParams,
  ModelConnector as ModelConnectorInterface,
  BatchConfirmation,
  BatchUpdateRequestItems,
  BatchDeleteRequestItems,
  BatchUpdateChange,
  BatchDeleteChange,
  SyncObject,
} from "./syncConnector";
import { validateAgainstSchema } from "../utils/schemaValidation";

/**
 * ModelConnectorBuilder - builds a connector for a specific model
 * This allows creating model connectors independently from sync connectors
 */
export class ModelConnectorBuilder<T = any> {
  private restConnector: RestConnector;
  private model: Model;
  private config: ModelConnectorConfig<T> = {};

  constructor(restConnector: RestConnector, model: Model) {
    this.restConnector = restConnector;
    this.model = model;
  }

  list(config: ListConfig<T, any>): this {
    this.config.list = config;
    return this;
  }

  create(config: CreateConfig<T>): this {
    this.config.create = config;
    return this;
  }

  update(config: UpdateConfig<T>): this {
    this.config.update = config;
    return this;
  }

  delete(config: DeleteConfig): this {
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
    };
    responseSchema?: TSchema;
    extract?: (
      response: TSchema extends z.ZodType<any> ? z.infer<TSchema> : unknown
    ) => Array<BatchConfirmation>;
    batchSize?: number;
    payloadType?: "items" | "changes";
  }): this {
    return this.batchCreate(config as BatchCreateOperationConfig<T>);
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
    };
    responseSchema?: TSchema;
    extract?: (
      response: TSchema extends z.ZodType<any> ? z.infer<TSchema> : unknown
    ) => Array<BatchConfirmation>;
    batchSize?: number;
    payloadType?: "items" | "changes";
  }): this {
    return this.batchUpdate(config as BatchUpdateOperationConfig<T>);
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
    };
    responseSchema?: TSchema;
    extract?: (
      response: TSchema extends z.ZodType<any> ? z.infer<TSchema> : unknown
    ) => Array<BatchConfirmation>;
    batchSize?: number;
    payloadType?: "ids" | "changes";
  }): this {
    return this.batchDelete(config as BatchDeleteOperationConfig);
  }

  build(): ModelConnectorInterface<T> {
    const connector: ModelConnectorInterface<T> = {
      modelName: this.model.name,
      config: this.config,
    };

    // Add list implementation
    if (this.config.list) {
      connector.list = async (params?: ListParams) => {
        const _params: ListParams = params || ({ syncType: "FULL" } as any);
        const requestConfig = this.config.list!.request(_params);

        const response = await this.restConnector.request({
          method: requestConfig.method || "GET",
          url: requestConfig.endpoint,
          params: requestConfig.params,
          // prefer json if provided; otherwise fall back to data
          json: (requestConfig as any).json ?? requestConfig.data,
        });

        let data = response.data;
        let items: Array<SyncObject<T>> = [];

        if (this.config.list!.responseSchema) {
          data = this.config.list!.responseSchema.parse(data);
        }

        if (this.config.list!.transform) {
          items = this.config.list!.transform(data);
        } else {
          items = data as Array<SyncObject<T>>;
        }

        // Validate each item's data field against the model schema
        if (this.model.schema && items.length > 0) {
          items.forEach((item, index) => {
            validateAgainstSchema(
              item.data,
              this.model.schema as any,
              `Model "${this.model.name}" list item ${index}`
            );
          });
        }

        if (this.config.list!.filter) {
          items = items.filter((obj) =>
            this.config.list!.filter!({
              obj,
              lastExternalId: _params.lastExternalId,
              lastExternalUpdatedAt: _params.lastExternalUpdatedAt,
              syncType: _params.syncType,
            })
          );
        }

        const pg = this.config.list!.pagination as
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

    // Add create implementation
    if (this.config.create) {
      connector.create = async (data: T) => {
        const transformedData = this.config.create!.transformRequest
          ? this.config.create!.transformRequest(data)
          : data;

        const requestConfig = this.config.create!.request(data);

        const response = await this.restConnector.request({
          method: requestConfig.method || "POST",
          url: requestConfig.endpoint,
          data: requestConfig.data || transformedData,
        });

        const result = this.config.create!.transform
          ? this.config.create!.transform(response.data)
          : response.data;

        // Validate the transformed result against the model schema
        if (this.model.schema) {
          validateAgainstSchema(
            result,
            this.model.schema as any,
            `Model "${this.model.name}" create result`
          );
        }

        return result;
      };
    }

    // Add update implementation
    if (this.config.update) {
      connector.update = async (id: string, data: Partial<T>) => {
        const transformedData = this.config.update!.transformRequest
          ? this.config.update!.transformRequest(data)
          : data;

        const requestConfig = this.config.update!.request(id, data);

        const response = await this.restConnector.request({
          method: requestConfig.method || "PUT",
          url: requestConfig.endpoint,
          data: requestConfig.data || transformedData,
        });

        const result = this.config.update!.transform
          ? this.config.update!.transform(response.data)
          : response.data;

        // Validate the transformed result against the model schema
        if (this.model.schema) {
          validateAgainstSchema(
            result,
            this.model.schema as any,
            `Model "${this.model.name}" update result`
          );
        }

        return result;
      };
    }

    // Add delete implementation
    if (this.config.delete) {
      connector.delete = async (id: string) => {
        const requestConfig = this.config.delete!.request(id);

        await this.restConnector.request({
          method: requestConfig.method || "DELETE",
          url: requestConfig.endpoint,
          data: requestConfig.data,
        });
      };
    }

    // Add batch implementations
    if (this.config.batchCreate) {
      connector.batchCreate = async (items: any[]) => {
        const batchSize = this.config.batchCreate!.batchSize || 100;
        const aggregatedResponses: any[] = [];
        const confirmations: BatchConfirmation[] = [];
        const isChangePayload =
          this.config.batchCreate!.payloadType === "changes";

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
          const requestConfig =
            this.config.batchCreate!.request(formattedBatch);

          const response = await this.restConnector.request({
            method: requestConfig.method || "POST",
            url: requestConfig.endpoint,
            data: requestConfig.json ?? requestConfig.data ?? formattedBatch,
          });

          let responseData = response.data;
          if (this.config.batchCreate!.responseSchema) {
            responseData =
              this.config.batchCreate!.responseSchema!.parse(responseData);
          }

          if (this.config.batchCreate!.extract) {
            const extracted = (this.config.batchCreate!.extract(responseData) ??
              []) as Array<BatchConfirmation>;
            confirmations.push(
              ...extracted.map((item: BatchConfirmation) => ({
                changeId: String(item.changeId),
                externalId: String(item.externalId),
                externalUpdatedAt:
                  item.externalUpdatedAt === undefined ||
                  item.externalUpdatedAt === null
                    ? null
                    : String(item.externalUpdatedAt),
              }))
            );
          }

          aggregatedResponses.push(
            ...(Array.isArray(responseData) ? responseData : [responseData])
          );
        }

        return this.config.batchCreate!.extract
          ? confirmations
          : aggregatedResponses;
      };
    }

    if (this.config.batchUpdate) {
      connector.batchUpdate = async (items: BatchUpdateRequestItems<any>) => {
        const batchSize = this.config.batchUpdate!.batchSize || 100;
        const aggregatedResponses: any[] = [];
        const confirmations: BatchConfirmation[] = [];
        const payloadType =
          this.config.batchUpdate!.payloadType ??
          (this.config.batchUpdate!.extract ? "changes" : "items");

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
          const requestConfig = this.config.batchUpdate!.request(
            formattedBatch as any
          );

          const response = await this.restConnector.request({
            method: requestConfig.method || "PUT",
            url: requestConfig.endpoint,
            data: requestConfig.json ?? requestConfig.data ?? formattedBatch,
          });

          let responseData = response.data;
          if (this.config.batchUpdate!.responseSchema) {
            responseData =
              this.config.batchUpdate!.responseSchema!.parse(responseData);
          }

          if (this.config.batchUpdate!.extract) {
            const extracted = (this.config.batchUpdate!.extract!(
              responseData
            ) ?? []) as Array<BatchConfirmation>;
            confirmations.push(
              ...extracted.map((item: BatchConfirmation) => ({
                changeId: String(item.changeId),
                externalId: String(item.externalId),
                externalUpdatedAt:
                  item.externalUpdatedAt === undefined ||
                  item.externalUpdatedAt === null
                    ? null
                    : String(item.externalUpdatedAt),
              }))
            );
          }

          aggregatedResponses.push(
            ...(Array.isArray(responseData) ? responseData : [responseData])
          );
        }

        return this.config.batchUpdate!.extract
          ? confirmations
          : aggregatedResponses;
      };
    }

    if (this.config.batchDelete) {
      connector.batchDelete = async (items: BatchDeleteRequestItems) => {
        const batchSize = this.config.batchDelete!.batchSize || 100;
        const confirmations: BatchConfirmation[] = [];
        const payloadType =
          this.config.batchDelete!.payloadType ??
          (this.config.batchDelete!.extract ? "changes" : "ids");

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
          const requestConfig = this.config.batchDelete!.request(
            formattedBatch as any
          );

          const response = await this.restConnector.request({
            method: requestConfig.method || "DELETE",
            url: requestConfig.endpoint,
            data: requestConfig.json ?? requestConfig.data ?? formattedBatch,
          });

          if (this.config.batchDelete!.extract) {
            let responseData = response.data;
            if (this.config.batchDelete!.responseSchema) {
              responseData =
                this.config.batchDelete!.responseSchema!.parse(responseData);
            }
            const extracted = (this.config.batchDelete!.extract!(
              responseData
            ) ?? []) as Array<BatchConfirmation>;
            confirmations.push(
              ...extracted.map((item: BatchConfirmation) => ({
                changeId: String(item.changeId),
                externalId: String(item.externalId),
                externalUpdatedAt:
                  item.externalUpdatedAt === undefined ||
                  item.externalUpdatedAt === null
                    ? null
                    : String(item.externalUpdatedAt),
              }))
            );
          }
        }

        return confirmations;
      };
    }

    return connector;
  }
}

/**
 * Factory function for creating a model connector
 */
export function createModelConnector<T = any>(
  restConnector: RestConnector,
  model: Model
): ModelConnectorBuilder<T>;
export function createModelConnector<M extends Model>(
  restConnector: RestConnector,
  model: M
): ModelConnectorBuilder<InferModelData<M>>;
export function createModelConnector(
  restConnector: RestConnector,
  model: Model
): ModelConnectorBuilder<any> {
  return new ModelConnectorBuilder<any>(restConnector, model);
}

/**
 * Type helper to extract model type from schema
 */
export type InferModelType<S> = S extends z.ZodType<infer T> ? T : any;
