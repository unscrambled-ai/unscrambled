import { ActionBuilder } from "./action";
import type { RunFuncProps } from "../types";

// Simpler approach: Use function overloads and const assertions
// This works with the existing ActionBuilder without modifications

// Helper type to extract variable/secret names from const arrays
type ExtractNames<T extends readonly string[]> = T[number];

// Create typed run function props
type TypedRunProps<
  V extends readonly string[],
  S extends readonly string[]
> = Omit<RunFuncProps, "variables" | "secrets"> & {
  variables: Record<ExtractNames<V>, string | null>;
  secrets: Record<ExtractNames<S>, string | null>;
};

// Factory function with type inference
export function defineTypedAction<
  const V extends readonly string[],
  const S extends readonly string[]
>(
  name: string,
  config: {
    variables?: V;
    secrets?: S;
    title?: string;
    description?: string;
  }
) {
  const builder = new ActionBuilder(name);

  if (config.title) builder.withTitle(config.title);
  if (config.description) builder.withDescription(config.description);
  if (config.variables) builder.withVariables([...config.variables]);
  if (config.secrets) builder.withSecrets([...config.secrets]);

  return {
    withRun: (fn: (props: TypedRunProps<V, S>) => Promise<void>) => {
      builder.withRun(fn as any);
      return builder;
    },
    // Pass through other methods if needed
    deploy: () => builder.deploy(),
  };
}

// Even simpler: Use template literal types for better autocomplete
export function defineActionWithSchema<
  Schema extends {
    variables?: Record<string, { required?: boolean; defaultValue?: string }>;
    secrets?: Record<string, { required?: boolean }>;
  }
>(name: string, schema: Schema) {
  type Variables = {
    [K in keyof Schema["variables"]]: Schema["variables"][K]["required"] extends true
      ? string
      : string | null;
  };

  type Secrets = {
    [K in keyof Schema["secrets"]]: Schema["secrets"][K]["required"] extends true
      ? string
      : string | null;
  };

  const builder = new ActionBuilder(name);

  // Add variables from schema
  if (schema.variables) {
    Object.entries(schema.variables).forEach(([varName, config]) => {
      builder.addVariable(varName, config);
    });
  }

  // Add secrets from schema
  if (schema.secrets) {
    Object.entries(schema.secrets).forEach(([secretName, config]) => {
      builder.addSecret(secretName, config);
    });
  }

  return {
    withRun: (
      fn: (
        props: Omit<RunFuncProps, "variables" | "secrets"> & {
          variables: Variables;
          secrets: Secrets;
        }
      ) => Promise<void>
    ) => {
      builder.withRun(fn as any);
      return builder;
    },
    deploy: () => builder.deploy(),
  };
}

// Usage examples:

// Example 1: Using const arrays
export const example1 = defineTypedAction("myAction", {
  variables: ["apiUrl", "timeout"] as const,
  secrets: ["apiKey", "optionalToken"] as const,
  title: "My Typed Action",
})
  .withRun(async ({ variables, secrets }) => {
    // TypeScript provides autocomplete for:
    console.log(variables.apiUrl); // string | null
    console.log(variables.timeout); // string | null
    console.log(secrets.apiKey); // string | null
    console.log(secrets.optionalToken); // string | null

    // This would show error in IDE:
    // console.log(variables.unknownVar); // Error!
  })
  .deploy();

// Example 2: Using schema with required fields
export const example2 = defineActionWithSchema("myAction2", {
  variables: {
    apiUrl: { required: true },
    timeout: { required: false, defaultValue: "30" },
  },
  secrets: {
    apiKey: { required: true },
    optionalToken: { required: false },
  },
})
  .withRun(async ({ variables, secrets }) => {
    // Now TypeScript knows:
    console.log(variables.apiUrl); // string (required)
    console.log(variables.timeout); // string | null (optional)
    console.log(secrets.apiKey); // string (required)
    console.log(secrets.optionalToken); // string | null (optional)
  })
  .deploy();
