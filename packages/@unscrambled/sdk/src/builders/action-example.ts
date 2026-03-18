import { defineAction } from "./action";

/**
 * Examples showing the type-safe defineAction in use
 */

// Example 1: Basic action with type-safe variables and secrets
const sendNotification = defineAction("sendNotification")
  .withTitle("Send Notification")
  .withDescription("Send a notification to a user")
  .addVariable("userId", {
    required: true,
    description: "ID of the user to notify",
  })
  .addVariable("message", {
    required: true,
    description: "Notification message",
  })
  .addVariable("priority", {
    required: false,
    defaultValue: "normal",
    description: "Notification priority level",
  })
  .addSecret("apiToken", {
    required: true,
    description: "API token for notification service",
  })
  .withRun(async ({ variables, secrets }) => {
    // TypeScript knows these exact types:
    const userId = variables.userId2; // type: string (required)
    const message = variables.message; // type: string (required)
    const priority = variables.priority; // type: string | null (optional)
    const token = secrets.apiToken; // type: string (required)

    // TypeScript error if you try to access non-existent variable:
    // const invalid = variables.nonExistent;  // Error: Property 'nonExistent' does not exist

    console.log(
      `Sending ${priority || "normal"} priority notification to user ${userId}`
    );
    console.log(`Message: ${message}`);
  });

// Example 2: Building complex actions with many variables
const dataProcessor = defineAction("processData")
  .withTitle("Process Data")
  .addVariable("inputPath", { required: true })
  .addVariable("outputPath", { required: true })
  .addVariable("format", { required: false, defaultValue: "json" })
  .addVariable("compression", { required: false })
  .addVariable("validate", { required: false, defaultValue: "true" })
  .addSecret("encryptionKey", { required: true })
  .addSecret("signatureKey", { required: false })
  .withRun(async ({ variables, secrets }) => {
    // All variable types are properly inferred:
    console.log(`Processing ${variables.inputPath} -> ${variables.outputPath}`);
    console.log(`Format: ${variables.format || "json"}`);

    if (variables.compression) {
      console.log(`Using compression: ${variables.compression}`);
    }

    const shouldValidate = variables.validate !== "false";
    if (shouldValidate) {
      console.log("Validation enabled");
    }

    // Secrets are also type-safe
    console.log(`Encryption key available: ${!!secrets.encryptionKey}`);
    if (secrets.signatureKey) {
      console.log("Will sign output");
    }
  });

// Example 3: Using withVariables/withSecrets for batch configuration
const batchConfigAction = defineAction("batchConfig")
  .withVariables([
    { name: "host", required: true },
    { name: "port", required: false, defaultValue: "443" },
    { name: "protocol", required: false, defaultValue: "https" },
  ] as const) // 'as const' preserves literal types
  .withSecrets([
    { name: "username", required: true },
    { name: "password", required: true },
    { name: "mfaToken", required: false },
  ] as const)
  .withRun(async ({ variables, secrets }) => {
    // TypeScript knows all the variables and their types
    const url = `${variables.protocol || "https"}://${variables.host}:${
      variables.port || "443"
    }`;
    console.log(`Connecting to ${url}`);
    console.log(`Authenticating as ${secrets.username}`);

    if (secrets.mfaToken) {
      console.log("Using MFA token");
    }
  });

// Example 4: Duplicating and extending actions
const baseApiAction = defineAction("baseApi")
  .addVariable("endpoint", { required: true })
  .addSecret("apiKey", { required: true });

const extendedApiAction = baseApiAction
  .duplicateAs("extendedApi")
  .withTitle("Extended API Action")
  .addVariable("timeout", { required: false, defaultValue: "30000" })
  .addVariable("retries", { required: false, defaultValue: "3" })
  .withRun(async ({ variables, secrets }) => {
    // Has all variables from base plus new ones
    console.log(`Calling ${variables.endpoint}`);
    console.log(`Timeout: ${variables.timeout || "30000"}ms`);
    console.log(`Max retries: ${variables.retries || "3"}`);
    console.log(`Using API key: ${secrets.apiKey.substring(0, 4)}...`);
  });

// Example 5: Backward compatibility - using strings
const simpleAction = defineAction("simple")
  .withVariables(["var1", "var2", "var3"]) // Simple string array still works
  .withSecrets(["secret1", "secret2"])
  .withRun(async ({ variables, secrets }) => {
    // All variables/secrets are string | null when using simple syntax
    console.log(variables.var1); // string | null
    console.log(variables.var2); // string | null
    console.log(secrets.secret1); // string | null
  });

// Deploy all examples
export const actions = [
  sendNotification.deploy(),
  dataProcessor.deploy(),
  batchConfigAction.deploy(),
  extendedApiAction.deploy(),
  simpleAction.deploy(),
];

// Example showing the difference in developer experience:

// With type safety (current implementation):
defineAction("typeSafe")
  .addVariable("apiUrl", { required: true })
  .addVariable("timeout", { required: false })
  .withRun(async ({ variables }) => {
    // IDE provides autocomplete for 'apiUrl' and 'timeout'
    // TypeScript knows apiUrl is string, timeout is string | null
    fetch(variables.apiUrl, {
      signal: AbortSignal.timeout(parseInt(variables.timeout || "5000")),
    });
  });

// The beauty is that this all works at compile time with zero runtime overhead!
