/**
 * Utility functions for the SDK
 */

/**
 * Capitalizes the first letter of a string
 * Examples:
 * - "customer" -> "Customer"
 * - "order" -> "Order"
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts snake_case or kebab-case to Title Case
 * Examples:
 * - "in_store_order" -> "In Store Order"
 * - "vip-customer" -> "Vip Customer"
 */
export function toTitleCase(str: string): string {
  return str
    .split(/[_-]/)
    .map((word) => capitalize(word))
    .join(" ");
}

/**
 * Gets the display title for a resource, using the title if provided,
 * otherwise generating one from the name
 */
export function getDisplayTitle(name: string, title?: string): string {
  if (title) {
    return title;
  }

  // If name contains underscores or hyphens, convert to title case
  if (name.includes("_") || name.includes("-")) {
    return toTitleCase(name);
  }

  // Otherwise just capitalize the first letter
  return capitalize(name);
}

/**
 * Get environment name following Lightyear conventions
 * @internal
 */
export function getEnvName(): string {
  return process.env.ENV_NAME || "dev";
}

export * from "./httpErrors";
export { ValidationError } from "./ValidationError";
