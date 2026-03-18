import { z } from "zod";
import type { Collection, Model } from "../types";

/**
 * Helper functions for creating strongly typed sync connectors
 */

/**
 * Extract the schema type from a Zod schema
 */
export type InferZodType<T> = T extends z.ZodTypeAny ? z.infer<T> : never;

/**
 * Create a typed list response schema
 */
export function createListResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T
): z.ZodArray<T> {
  return z.array(itemSchema);
}

/**
 * Create a paginated list response schema
 */
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  options?: {
    itemsField?: string;
    cursorField?: string;
    hasMoreField?: string;
  }
) {
  const itemsField = options?.itemsField || "data";
  const cursorField = options?.cursorField || "nextCursor";
  const hasMoreField = options?.hasMoreField || "hasMore";

  return z.object({
    [itemsField]: z.array(itemSchema),
    [cursorField]: z.string().optional(),
    [hasMoreField]: z.boolean().optional(),
  });
}

/**
 * Helper to validate sync configuration against collection models
 */
export function validateModelExists(
  collection: Collection,
  modelName: string
): Model {
  const model = collection.models.find((m) => m.name === modelName);

  if (!model) {
    const availableModels = collection.models.map((m) => m.name).join(", ");
    throw new Error(
      `Model "${modelName}" does not exist in collection "${collection.name}". ` +
        `Available models: ${availableModels}`
    );
  }

  return model;
}

/**
 * Helper to extract nested data from a response
 */
export function extractNestedData(data: any, path: string): any {
  if (!path) return data;

  const segments = path.split(".");
  let result = data;

  for (const segment of segments) {
    if (result === null || result === undefined) {
      return undefined;
    }
    result = result[segment];
  }

  return result;
}

/**
 * Batch items for batch operations
 */
export function batchItems<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  return batches;
}

/**
 * Create a type-safe model connector configuration
 */
export function createModelConfig<T>() {
  return {
    list: (config: {
      endpoint: string;
      method?: "GET" | "POST";
      responseSchema?: z.ZodType<T>;
      pagination?: (response: any) => { cursor?: string | null };
    }) => ({ list: config }),

    create: (config: { endpoint: string; method?: "POST" | "PUT" }) => ({
      create: config,
    }),

    update: (config: {
      endpoint: string | ((id: string) => string);
      method?: "PUT" | "PATCH" | "POST";
    }) => ({ update: config }),

    delete: (config: {
      endpoint: string | ((id: string) => string);
      method?: "DELETE" | "POST";
    }) => ({ delete: config }),

    batch: (config: {
      create?: {
        endpoint: string;
        method?: "POST" | "PUT";
        batchSize?: number;
      };
      update?: {
        endpoint: string;
        method?: "PUT" | "PATCH" | "POST";
        batchSize?: number;
      };
      delete?: {
        endpoint: string;
        method?: "DELETE" | "POST";
        batchSize?: number;
      };
    }) => ({ batch: config }),
  };
}
