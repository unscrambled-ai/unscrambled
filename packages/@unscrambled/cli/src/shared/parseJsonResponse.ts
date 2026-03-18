import { terminal } from "terminal-kit";

export interface ParseJsonResponseOptions {
  operationName?: string;
  showResponsePreview?: boolean;
}

/**
 * Safely parse a JSON response with detailed error reporting
 *
 * This helper improves error messages when the API returns HTML instead of JSON
 * (common with rate limits, server errors, etc.)
 */
export async function parseJsonResponse(
  response: Response,
  options: ParseJsonResponseOptions = {}
): Promise<any> {
  const { operationName = "API request", showResponsePreview = true } = options;

  try {
    const text = await response.text();

    // Try to parse as JSON
    try {
      return JSON.parse(text);
    } catch (parseError) {
      // JSON parsing failed - provide detailed diagnostics
      terminal.red(`\n❌ Failed to parse ${operationName} response as JSON\n`);
      terminal(`HTTP Status: ${response.status} ${response.statusText}\n`);

      // Check for common error scenarios
      if (response.status === 429) {
        terminal.yellow(
          `\n⚠️  Rate limit exceeded. Please wait before retrying.\n`
        );
      } else if (response.status >= 500 && response.status < 600) {
        terminal.yellow(
          `\n⚠️  Server error (${response.status}). The Lightyear API may be experiencing issues.\n`
        );
      } else if (response.status === 401 || response.status === 403) {
        terminal.yellow(
          `\n⚠️  Authentication failed. Check your LIGHTYEAR_API_KEY.\n`
        );
      }

      // Show response preview to help diagnose the issue
      if (showResponsePreview) {
        const preview = text.substring(0, 500);
        terminal(`\nResponse body (first 500 chars):\n`);
        terminal.dim(`${preview}${text.length > 500 ? "..." : ""}\n`);
      }

      // Show content type if it's not JSON
      const contentType = response.headers.get("content-type");
      if (contentType && !contentType.includes("application/json")) {
        terminal(`\nContent-Type: ${contentType}\n`);
        if (contentType.includes("text/html")) {
          terminal.yellow(
            `The server returned HTML instead of JSON. This usually indicates:\n`
          );
          terminal.yellow(`  • A rate limit page\n`);
          terminal.yellow(`  • A server error page (502, 503, 504)\n`);
          terminal.yellow(`  • An authentication error page\n`);
        }
      }

      terminal("\n");

      throw new Error(
        `Failed to parse ${operationName} response: Expected JSON but received ${
          contentType || "unknown content type"
        }. ` + `HTTP ${response.status}: ${response.statusText}`
      );
    }
  } catch (error) {
    // If we already threw our custom error, re-throw it
    if (error instanceof Error && error.message.includes("Failed to parse")) {
      throw error;
    }

    // Otherwise, it's an error reading the response text
    terminal.red(`\n❌ Failed to read ${operationName} response\n`);
    console.error(error);
    throw error;
  }
}

/**
 * Check if a response is OK and provide detailed error if not
 */
export function checkResponseOk(
  response: Response,
  operationName: string = "API request"
): void {
  if (!response.ok) {
    terminal.red(`\n❌ ${operationName} failed\n`);
    terminal(`HTTP Status: ${response.status} ${response.statusText}\n`);

    // Provide helpful context for common status codes
    if (response.status === 429) {
      terminal.yellow(
        `\n⚠️  Rate limit exceeded. Please wait before retrying.\n\n`
      );
    } else if (response.status >= 500) {
      terminal.yellow(
        `\n⚠️  Server error. The Lightyear API may be experiencing issues.\n\n`
      );
    } else if (response.status === 401 || response.status === 403) {
      terminal.yellow(
        `\n⚠️  Authentication failed. Check your LIGHTYEAR_API_KEY.\n\n`
      );
    } else if (response.status === 404) {
      terminal.yellow(
        `\n⚠️  Resource not found. Check your environment name and configuration.\n\n`
      );
    }
  }
}
