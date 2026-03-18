import type { JSONSchema7 } from "json-schema";
import type { Model, MatchPattern, Collection } from "../types";
import type { z } from "zod";
import { registerModel } from "../registry";
import { CollectionBuilder } from "./collection";

// Type to accept JSONSchema7, const object schemas, and Zod schemas
type Schema = JSONSchema7 | Readonly<any> | z.ZodType<any>;

/**
 * Model Builder - fluent API for creating models that belong to a collection
 */
export class ModelBuilder<TSchema = unknown, TName extends string = string> {
  private collection: Collection | CollectionBuilder;
  private name: TName;
  private title?: string;
  private schema?: TSchema extends Readonly<any>
    ? TSchema
    : TSchema extends z.ZodType<any>
    ? TSchema
    : JSONSchema7;
  private matchPattern?: MatchPattern;

  constructor(collection: Collection | CollectionBuilder, name: TName) {
    this.collection = collection;
    this.name = name;
  }

  /**
   * Copy-constructor: create a builder from an existing model
   */
  static from<TS = unknown, TN extends string = string>(
    collection: Collection | CollectionBuilder,
    source: Model<TS, TN>
  ): ModelBuilder<TS, TN> {
    const builder = new ModelBuilder<TS, TN>(collection, source.name as TN);
    if (source.title) builder.withTitle(source.title);
    if (source.schema) builder.withSchema(source.schema as any);
    if (source.matchPattern) builder.withMatchPattern(source.matchPattern);
    return builder;
  }

  withTitle(title: string): this {
    this.title = title;
    return this;
  }

  withSchema<TNewSchema extends Schema>(
    schema: TNewSchema
  ): ModelBuilder<TNewSchema, TName> {
    this.schema = schema as any;
    return this as unknown as ModelBuilder<TNewSchema, TName>;
  }

  withMatchPattern(pattern: MatchPattern): this {
    this.matchPattern = pattern;
    return this;
  }

  deploy(): Model<TSchema, TName> {
    const model: Model<TSchema, TName> = {
      name: this.name,
      title: this.title,
      schema: this.schema,
      matchPattern: this.matchPattern,
    };

    // If collection is a CollectionBuilder, add the model to it
    if (this.collection instanceof CollectionBuilder) {
      this.collection.withModel(model as unknown as Model);
    } else {
      // If it's already a deployed collection, add to its models array
      if (!this.collection.models.some((m) => m.name === model.name)) {
        this.collection.models.push(model as unknown as Model);
      }
    }

    // Register the model in the global registry
    const collectionName =
      this.collection instanceof CollectionBuilder
        ? this.collection.getName()
        : this.collection.name;

    registerModel(model, {
      builderType: "ModelBuilder",
      createdBy: "defineModel",
      parentCollection: collectionName,
    });

    return model;
  }
}

/**
 * Factory function for creating a model builder
 * @param collection - The collection this model belongs to
 * @param name - The name of the model
 */
export interface DefineModelFn {
  <N extends string>(
    collection: Collection | CollectionBuilder,
    name: N
  ): ModelBuilder<unknown, N>;
  from: <TS = unknown, TN extends string = string>(
    collection: Collection | CollectionBuilder,
    source: Model<TS, TN>
  ) => ModelBuilder<TS, TN>;
}

export const defineModel: DefineModelFn = ((collection: any, name: any) =>
  new ModelBuilder(collection, name)) as unknown as DefineModelFn;

defineModel.from = (collection: any, source: any) =>
  ModelBuilder.from(collection, source);
