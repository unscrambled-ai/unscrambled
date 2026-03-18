import { describe, it, expect } from "vitest";
import { defineModel } from "./model";
import { defineCollection } from "./collection";

describe("ModelBuilder", () => {
  it("should create a basic model", () => {
    const collection = defineCollection("users");
    const model = defineModel(collection, "user")
      .withTitle("User Model")
      .deploy();

    expect(model.name).toBe("user");
    expect(model.title).toBe("User Model");
    expect(model.schema).toBeUndefined();
    expect(model.matchPattern).toBeUndefined();
  });

  it("should create a model with schema and match pattern", () => {
    const collection = defineCollection("customers");
    const schema = {
      type: "object" as const,
      properties: {
        id: { type: "string" as const },
        email: { type: "string" as const, format: "email" },
      },
    };

    const model = defineModel(collection, "customer")
      .withTitle("Customer")
      .withSchema(schema)
      .withMatchPattern("email")
      .deploy();

    expect(model.name).toBe("customer");
    expect(model.title).toBe("Customer");
    expect(model.schema).toEqual(schema);
    expect(model.matchPattern).toBe("email");
  });

  it("should support method chaining", () => {
    const collection = defineCollection("products");
    const model = defineModel(collection, "product")
      .withTitle("Product")
      .withSchema({
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
      })
      .withMatchPattern("id")
      .deploy();

    expect(model.name).toBe("product");
    expect(model.title).toBe("Product");
    expect(model.matchPattern).toBe("id");
  });

  it("should add model to collection when deployed", () => {
    const collection = defineCollection("items");
    const model = defineModel(collection, "item").withTitle("Item").deploy();

    // The model should be added to the collection builder
    const deployedCollection = collection.deploy();
    expect(deployedCollection.models).toHaveLength(1);
    expect(deployedCollection.models[0].name).toBe("item");
  });

  it("should work with deployed collections", () => {
    const deployedCollection = defineCollection("orders")
      .withTitle("Orders")
      .deploy();

    const model = defineModel(deployedCollection, "order")
      .withTitle("Order")
      .deploy();

    expect(deployedCollection.models).toHaveLength(1);
    expect(deployedCollection.models[0].name).toBe("order");
  });
});
