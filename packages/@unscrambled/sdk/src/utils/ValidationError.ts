/**
 * Custom error class for validation failures that should be displayed without stack traces
 */
export class ValidationError extends Error {
  public readonly isValidationError = true;
  public readonly details: string;
  public readonly data: unknown;

  constructor(message: string, details: string, data: unknown) {
    // Include the full details in the message itself since it may be serialized
    const dataSample = JSON.stringify(data, null, 2);
    const displayData =
      dataSample.length > 300
        ? dataSample.slice(0, 300) + "\n  ..."
        : dataSample;

    super(`${message}:\n${details}\n\nActual data:\n${displayData}`);

    this.name = "ValidationError";
    this.details = details;
    this.data = data;

    // Mark this error so we can identify it even after serialization
    (this as any).__isValidationError = true;
  }

  /**
   * Get the full error message with details and data
   */
  getFullMessage(): string {
    return `${this.message}:\n${this.details}\n\nActual data:\n${JSON.stringify(
      this.data,
      null,
      2
    ).slice(0, 300)}${
      JSON.stringify(this.data, null, 2).length > 300 ? "\n  ..." : ""
    }`;
  }
}
