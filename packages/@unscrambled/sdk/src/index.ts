/**
 * @unscrambled/sdk
 *
 * TypeScript SDK for building integrations with Unscrambled
 */

// Core SDK exports
export * from "./types";
export * from "./builders";
export * from "./utils";
export * from "./registry";
export * from "./connectors";

// Handler exports (for deployment in Lambda, VM, etc.)
export * from "./handlers";

// HTTP exports (for making requests)
export * from "./http";

// Logging exports (for log capture and upload)
export * from "./logging";

// Platform sync API exports (for manual sync lifecycle control)
export { getSync, pauseSync, continueSync, finishSync } from "./platform/sync";

// Built-in collections
export * from "./collections/crm";
