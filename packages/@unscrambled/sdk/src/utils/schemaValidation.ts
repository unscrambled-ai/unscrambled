import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { JSONSchema7 } from "json-schema";
import type { z } from "zod";
import { ValidationError } from "./ValidationError";

// Create a singleton Ajv instance
let ajvInstance: Ajv | null = null;

function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false, // Allow additional keywords like "references"
    });
    addFormats(ajvInstance);
  }
  return ajvInstance;
}

/**
 * Validate data against a schema (JSON Schema or Zod)
 * @throws Error if validation fails with detailed error message
 */
export function validateAgainstSchema(
  data: unknown,
  schema: JSONSchema7 | z.ZodType<any> | undefined,
  context: string
): void {
  if (!schema) {
    // No schema provided, skip validation
    return;
  }

  // Check if it's a Zod schema
  if (typeof schema === "object" && "_def" in schema && "parse" in schema) {
    try {
      (schema as z.ZodType<any>).parse(data);
    } catch (error) {
      // Check if it's actually a ZodError with errors array
      if (
        error &&
        typeof error === "object" &&
        "errors" in error &&
        Array.isArray((error as any).errors)
      ) {
        const zodError = error as z.ZodError;
        const errorDetails = zodError.errors
          .map((err) => `  • ${err.path.join(".")}: ${err.message}`)
          .join("\n");

        throw new ValidationError(
          `${context} validation failed`,
          errorDetails,
          data
        );
      }
      // Fallback for other error types
      const err = new Error(
        `${context} validation failed (Zod): ${
          (error as Error).message || String(error)
        }`
      );
      // Use defineProperty to prevent JavaScript from regenerating the stack
      Object.defineProperty(err, "stack", {
        value: "",
        writable: false,
        configurable: false,
      });
      throw err;
    }
    return;
  }

  // Assume it's a JSON Schema
  const ajv = getAjv();
  const validate = ajv.compile(schema as JSONSchema7);
  const valid = validate(data);

  if (!valid) {
    const errorDetails = validate.errors
      ?.map((err) => {
        const path = err.instancePath || "(root)";
        let detail = `  • ${path} ${err.message}`;

        // Add more context for common error types
        if (
          err.keyword === "additionalProperties" &&
          err.params?.additionalProperty
        ) {
          detail += ` (found: "${err.params.additionalProperty}")`;
        } else if (err.keyword === "required" && err.params?.missingProperty) {
          detail += ` (missing: "${err.params.missingProperty}")`;
        } else if (err.keyword === "type") {
          detail += ` (found type: ${typeof (data as any)?.[
            err.instancePath?.split("/").pop() || ""
          ]})`;
        } else if (err.keyword === "enum" && err.params?.allowedValues) {
          detail += ` (allowed: ${JSON.stringify(err.params.allowedValues)})`;
        }

        return detail;
      })
      .join("\n");

    throw new ValidationError(
      `${context} validation failed`,
      errorDetails,
      data
    );
  }
}

/**
 * Validate an array of objects against a schema
 * Provides detailed error messages including which item failed
 */
export function validateArrayAgainstSchema(
  data: unknown[],
  schema: JSONSchema7 | z.ZodType<any> | undefined,
  context: string
): void {
  if (!schema) {
    return;
  }

  data.forEach((item, index) => {
    try {
      validateAgainstSchema(item, schema, `${context}[${index}]`);
    } catch (error) {
      throw new Error(
        `${context}[${index}] validation failed: ${(error as Error).message}`
      );
    }
  });
}
