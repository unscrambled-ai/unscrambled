import { describe, it, expect } from "vitest";
import { validateAgainstSchema } from "./schemaValidation";
import { z } from "zod";
import type { JSONSchema7 } from "json-schema";

describe("validateAgainstSchema", () => {
  describe("JSON Schema validation", () => {
    it("should pass validation for valid data", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["id", "name"],
      };

      const validData = {
        id: "123",
        name: "John Doe",
        age: 30,
      };

      expect(() =>
        validateAgainstSchema(validData, schema, "Test data")
      ).not.toThrow();
    });

    it("should fail validation for missing required field", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["id", "name"],
      };

      const invalidData = {
        id: "123",
        // missing 'name'
      };

      expect(() =>
        validateAgainstSchema(invalidData, schema, "Test data")
      ).toThrow(/Test data validation failed/);
    });

    it("should fail validation for wrong type", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          id: { type: "string" },
          age: { type: "number" },
        },
        required: ["id", "age"],
      };

      const invalidData = {
        id: "123",
        age: "thirty", // should be number
      };

      expect(() =>
        validateAgainstSchema(invalidData, schema, "Test data")
      ).toThrow(/Test data validation failed/);
    });

    it("should handle nested objects", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          id: { type: "string" },
          address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
            },
            required: ["city"],
          },
        },
        required: ["id", "address"],
      };

      const invalidData = {
        id: "123",
        address: {
          street: "123 Main St",
          // missing 'city'
        },
      };

      expect(() =>
        validateAgainstSchema(invalidData, schema, "Test data")
      ).toThrow(/Test data validation failed/);
    });
  });

  describe("Zod schema validation", () => {
    it("should pass validation for valid data with Zod", () => {
      const schema = z.object({
        id: z.string(),
        name: z.string(),
        age: z.number(),
      });

      const validData = {
        id: "123",
        name: "John Doe",
        age: 30,
      };

      expect(() =>
        validateAgainstSchema(validData, schema, "Test data")
      ).not.toThrow();
    });

    it("should fail validation for missing required field with Zod", () => {
      const schema = z.object({
        id: z.string(),
        name: z.string(),
      });

      const invalidData = {
        id: "123",
        // missing 'name'
      };

      expect(() =>
        validateAgainstSchema(invalidData as any, schema, "Test data")
      ).toThrow(/Test data validation failed/);
    });

    it("should fail validation for wrong type with Zod", () => {
      const schema = z.object({
        id: z.string(),
        age: z.number(),
      });

      const invalidData = {
        id: "123",
        age: "thirty", // should be number
      };

      expect(() =>
        validateAgainstSchema(invalidData as any, schema, "Test data")
      ).toThrow(/Test data validation failed/);
    });

    it("should handle Zod refinements", () => {
      const schema = z.object({
        id: z.string(),
        email: z.string().email(),
        age: z.number().min(18),
      });

      const invalidData = {
        id: "123",
        email: "not-an-email",
        age: 15,
      };

      expect(() =>
        validateAgainstSchema(invalidData, schema, "Test data")
      ).toThrow(/Test data validation failed/);
    });
  });

  describe("No schema provided", () => {
    it("should skip validation when schema is undefined", () => {
      const data = {
        anything: "goes",
      };

      expect(() =>
        validateAgainstSchema(data, undefined, "Test data")
      ).not.toThrow();
    });
  });
});
