import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import type { Collection, Model, MatchPattern } from "../types";
import { registerCollection, registerModel } from "../registry";

// For now we only support JSON Schema (or readonly JSON-like objects).
// Passing Zod schemas is intentionally disallowed at runtime.
type Schema = JSONSchema7 | Readonly<any>;

// Helper type to convert TModels array to a name->model mapping
type ModelsToMap<TModels> = TModels extends readonly Model<any, any>[]
  ? { [M in TModels[number] as M["name"]]: M }
  : {};

// Helper types to produce a name -> model data mapping for stronger inference
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

// Helper to map a single model to its data mapping
type SingleModelToDataMap<M> = M extends Model<infer S, infer N extends string>
  ? { [K in N]: import("../types").InferModelData<Model<S, N>> }
  : {};

// Distribute over union of models and combine with intersection
type ModelNameToDataMap<TModels> = UnionToIntersection<
  TModels extends readonly any[] ? SingleModelToDataMap<TModels[number]> : {}
>;

// Helper type: filter models by a list of names (preserve tuple order)
type FilterModelsByNames<
  TModels extends readonly Model<any, any>[],
  TNames extends readonly string[]
> = TModels extends readonly [infer H, ...infer R]
  ? H extends Model<any, infer N extends string>
    ? N extends TNames[number]
      ? readonly [
          H,
          ...FilterModelsByNames<Extract<R, readonly Model<any, any>[]>, TNames>
        ]
      : FilterModelsByNames<Extract<R, readonly Model<any, any>[]>, TNames>
    : FilterModelsByNames<Extract<R, readonly Model<any, any>[]>, TNames>
  : readonly [];

// Type for the getModel method with proper overloads
interface TypedCollectionMethods<TModels> {
  getModel<K extends keyof ModelsToMap<TModels> & string>(
    name: K
  ): ModelsToMap<TModels>[K] | undefined;
  getModel(name: string): Model<any, any> | undefined;
}

/**
 * Collection Builder - fluent API for creating collections
 */
export class CollectionBuilder<
  TModels extends readonly Model<any, any>[] = readonly [],
  TSchemas extends Record<string, any> = {}
> {
  private name: string;
  private title?: string;
  private models: Model<any, any>[] = [];

  constructor(name: string) {
    this.name = name;
  }

  getName(): string {
    return this.name;
  }

  withName(name: string): CollectionBuilder<TModels, TSchemas> {
    this.name = name;
    return this as any;
  }

  withTitle(title: string): CollectionBuilder<TModels, TSchemas> {
    this.title = title;
    return this as any;
  }

  /**
   * Limit the models in this collection to a provided subset of names.
   * - Type-safe: only existing model names are allowed
   * - Returns a new builder instance with narrowed model tuple and schema map
   */
  withOnlyModels<
    TNames extends readonly (TModels[number] extends Model<
      any,
      infer N extends string
    >
      ? N
      : never)[]
  >(
    ...names: TNames
  ): CollectionBuilder<
    FilterModelsByNames<TModels, TNames>,
    Pick<TSchemas, TNames[number]>
  > {
    const nameSet = new Set(names as readonly string[]);
    const filtered = this.models.filter((m) => nameSet.has(m.name));
    const builder = new CollectionBuilder(this.name);
    if (this.title) builder.withTitle(this.title);
    builder.withModels(filtered as any);
    return builder as any;
  }

  /**
   * Copy-constructor: create a builder from an existing collection or builder
   */
  static from(source: Collection | CollectionBuilder): CollectionBuilder {
    const name =
      source instanceof CollectionBuilder ? source.getName() : source.name;
    const builder = new CollectionBuilder(name);
    const title =
      source instanceof CollectionBuilder
        ? (source as any).title
        : source.title;
    if (title) builder.withTitle(title);
    const models =
      source instanceof CollectionBuilder
        ? (source as any).models
        : source.models;
    if (models && models.length > 0) {
      builder.withModels(models.map((m: Model<any, any>) => ({ ...m })) as any);
    }
    return builder;
  }

  withModel<M extends Model<any, any>>(
    model: M
  ): CollectionBuilder<readonly [...TModels, M], TSchemas> {
    this.models.push(model);
    return this as any;
  }

  withModels<M extends readonly Model<any, any>[]>(
    models: M
  ): CollectionBuilder<readonly [...TModels, ...M], TSchemas> {
    this.models.push(...models);
    return this as any;
  }

  addModel<N extends string, S extends Schema = any>(
    name: N,
    options?: {
      title?: string;
      schema?: S;
      matchPattern?: MatchPattern;
    }
  ): CollectionBuilder<
    readonly [...TModels, Model<S, N>],
    TSchemas & { [K in N]: S }
  > {
    // If a schema is provided, allow Zod and JSON Schema. Only sanity-check JSON Schema objects.
    const providedSchema = options?.schema as unknown;
    if (
      providedSchema &&
      typeof providedSchema === "object" &&
      !Array.isArray(providedSchema) &&
      !isZodSchema(providedSchema)
    ) {
      // Only attempt validation if the object appears to be a JSON Schema
      if (isJsonSchemaCandidate(providedSchema as Record<string, unknown>)) {
        validateJsonSchemaOrThrow(
          providedSchema as JSONSchema7,
          name as string
        );
      }
    }

    const model: Model<S, N> = {
      name,
      title: options?.title,
      schema: options?.schema,
      matchPattern: options?.matchPattern,
    } as Model<S, N>;

    // Register the model in the registry
    registerModel(model as Model<any, any>, {
      builderType: "CollectionBuilder",
      createdBy: "addModel",
      parentCollection: this.name,
    });

    this.models.push(model as Model<any, any>);
    return this as any;
  }

  deploy(): Collection &
    TypedCollectionMethods<TModels> & {
      __schemas?: TSchemas;
      __models?: TModels;
      __modelData?: ModelNameToDataMap<TModels>;
    } {
    // Build model map for efficient lookup
    const modelMap = new Map<string, Model<any, any>>();
    for (const model of this.models) {
      modelMap.set(model.name, model);
    }

    // Create collection with getModel method
    const collection: Collection = {
      name: this.name,
      title: this.title,
      models: this.models,
      getModel: (name: string) => modelMap.get(name),
    };

    // Register the collection in the global registry
    registerCollection(collection, {
      builderType: "CollectionBuilder",
      createdBy: "defineCollection",
      modelCount: this.models.length,
    });

    // Return with type assertion to preserve schema and model generic types for inference via phantom properties
    return collection as Collection &
      TypedCollectionMethods<TModels> & {
        __schemas?: TSchemas;
        __models?: TModels;
        __modelData?: ModelNameToDataMap<TModels>;
      };
  }
}

/**
 * Determine if a value is a Zod schema at runtime.
 */
function isZodSchema(value: unknown): value is z.ZodTypeAny {
  return (
    !!value &&
    typeof value === "object" &&
    // Zod schemas expose safeParse/parse methods
    (typeof (value as any).safeParse === "function" ||
      typeof (value as any).parse === "function")
  );
}

/**
 * Heuristic to decide whether an arbitrary object looks like a JSON Schema.
 * We do not attempt full validation here; we only proceed when common
 * JSON Schema keywords are present to avoid false positives for plain objects.
 */
function isJsonSchemaCandidate(obj: Record<string, unknown>): boolean {
  const jsonSchemaKeys = [
    "$schema",
    "$id",
    "$ref",
    "type",
    "properties",
    "items",
    "required",
    "oneOf",
    "anyOf",
    "allOf",
    "enum",
    "const",
    "format",
    "additionalProperties",
    "patternProperties",
    "minimum",
    "maximum",
  ];
  return jsonSchemaKeys.some((k) =>
    Object.prototype.hasOwnProperty.call(obj, k)
  );
}

/**
 * Minimal runtime sanity checks for a JSON Schema draft-07 object.
 * This is not a full JSON Schema validator, but it catches common mistakes
 * and provides clear error messages early in the developer workflow.
 */
function validateJsonSchemaOrThrow(
  schema: JSONSchema7,
  modelName: string
): void {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error(
      `Model "${modelName}": JSON schema must be a non-null object`
    );
  }

  // If type is provided, ensure it is valid
  const validTypes = [
    "string",
    "number",
    "integer",
    "boolean",
    "array",
    "object",
    "null",
  ];
  if (schema.type) {
    const typeVal = schema.type;
    if (
      !(typeof typeVal === "string"
        ? validTypes.includes(typeVal)
        : Array.isArray(typeVal) &&
          typeVal.every((t) => validTypes.includes(t)))
    ) {
      throw new Error(
        `Model "${modelName}": schema.type must be one of ${validTypes.join(
          ", "
        )}`
      );
    }
  }

  // If object schema, properties (when provided) must be an object map
  if (schema.type === "object" || schema.properties) {
    if (schema.properties && typeof schema.properties !== "object") {
      throw new Error(
        `Model "${modelName}": schema.properties must be an object when provided`
      );
    }
    if (schema.required && !Array.isArray(schema.required)) {
      throw new Error(
        `Model "${modelName}": schema.required must be an array of strings when provided`
      );
    }
  }

  // If array schema, items (when provided) must be a schema or array of schemas
  if (schema.type === "array" || schema.items) {
    const items = schema.items as unknown;
    const ok =
      !items ||
      typeof items === "object" ||
      (Array.isArray(items) && items.every((it) => typeof it === "object"));
    if (!ok) {
      throw new Error(
        `Model "${modelName}": schema.items must be a schema object or array of schema objects`
      );
    }
  }
}

/**
 * Factory function for creating a collection builder
 */
export interface DefineCollectionFn {
  (name: string): CollectionBuilder;
  from: (source: Collection | CollectionBuilder) => CollectionBuilder;
}

export const defineCollection: DefineCollectionFn = ((name: string) =>
  new CollectionBuilder(name)) as unknown as DefineCollectionFn;

defineCollection.from = (source: Collection | CollectionBuilder) =>
  CollectionBuilder.from(source);
