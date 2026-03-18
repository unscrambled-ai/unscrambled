import { Command, Option, program } from "commander";
import { terminal } from "terminal-kit";

import { requireAuth } from "../../shared/requireAuth";
import { getApiKey } from "../../shared/getApiKey";
import { getBaseUrl } from "../../shared/getBaseUrl";
import { getEnvName } from "../../shared/getEnvName";

type OutputFormat = "text" | "json";

function resolveEnvName(cliEnv?: string): string {
  if (cliEnv) return cliEnv;
  const globalEnv = program.opts().env;
  if (globalEnv) return globalEnv;
  return getEnvName();
}

function getEnvOption(options: any): string | undefined {
  return options?.env ?? options?.environment;
}

export const httpRequests = new Command("requests").description(
  "Inspect HTTP requests made during syncs and runs"
);

// List HTTP requests
httpRequests
  .command("list")
  .description("List HTTP requests")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(new Option("--sync <syncId>", "Filter by sync ID"))
  .addOption(new Option("--run <runId>", "Filter by run ID"))
  .addOption(
    new Option(
      "--status <status>",
      "Filter by status (QUEUED, RUNNING, SUCCEEDED, FAILED)"
    )
  )
  .addOption(
    new Option(
      "--after <timestamp>",
      "Show requests after this timestamp (ISO 8601)"
    )
  )
  .addOption(
    new Option(
      "--before <timestamp>",
      "Show requests before this timestamp (ISO 8601)"
    )
  )
  .addOption(
    new Option(
      "-l, --limit <count>",
      "Max number of requests to return"
    ).default("20")
  )
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (options: {
      env?: string;
      environment?: string;
      sync?: string;
      run?: string;
      status?: string;
      after?: string;
      before?: string;
      limit: string;
      output: OutputFormat;
    }) => {
      requireAuth();

      let envName: string;
      try {
        envName = resolveEnvName(getEnvOption(options));
      } catch (error) {
        terminal.red(
          `${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exitCode = 1;
        return;
      }

      try {
        const baseUrl = getBaseUrl();
        const apiKey = getApiKey();

        const params = new URLSearchParams();
        if (options.sync) params.set("syncId", options.sync);
        if (options.run) params.set("runId", options.run);
        if (options.status) params.set("status", options.status);
        if (options.after) params.set("after", options.after);
        if (options.before) params.set("before", options.before);

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/http-requests?${params}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          terminal.red(
            `List HTTP requests failed: HTTP ${response.status} ${response.statusText}\n`
          );
          process.exitCode = 1;
          return;
        }

        const result = (await response.json()) as {
          httpRequests: Array<{
            id: string;
            method: string;
            url: string;
            status: string;
            statusCode: number | null;
            statusText: string | null;
            createdAt: string;
            startedAt: string | null;
            endedAt: string | null;
            size: number | null;
            run: { id: string; syncRunNumber: number | null } | null;
          }>;
          cursor?: string;
        };

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          const requests = result.httpRequests ?? [];
          if (requests.length === 0) {
            terminal("No HTTP requests found\n");
            return;
          }

          terminal.bold(`HTTP Requests:\n\n`);
          const limit = parseInt(options.limit, 10);
          for (const req of requests.slice(0, limit)) {
            const statusColor =
              req.status === "SUCCEEDED"
                ? terminal.green
                : req.status === "FAILED"
                ? terminal.red
                : req.status === "RUNNING"
                ? terminal.yellow
                : terminal;

            // Calculate duration if we have timing
            let duration = "";
            if (req.startedAt && req.endedAt) {
              const ms =
                new Date(req.endedAt).getTime() -
                new Date(req.startedAt).getTime();
              duration = ` (${ms}ms)`;
            }

            // Format: [status] METHOD url (duration) - HTTP statusCode
            const httpStatus = req.statusCode
              ? ` - ${req.statusCode} ${req.statusText ?? ""}`
              : "";
            const time = new Date(req.createdAt)
              .toISOString()
              .substring(11, 19);

            terminal(`[${time}] `);
            statusColor(`${req.status.padEnd(9)} `);
            terminal(`${req.method.padEnd(6)} `);
            terminal.cyan(`${req.url}`);
            terminal.gray(`${duration}${httpStatus}`);
            terminal("\n");
            terminal.gray(`           ID: ${req.id}\n`);
          }

          if (result.cursor) {
            terminal.gray(`\n(more results available)\n`);
          }
        }
      } catch (error) {
        terminal.red(
          `${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exitCode = 1;
      }
    }
  );

// Get HTTP request details
httpRequests
  .command("get")
  .description("Get full details of an HTTP request including headers and body")
  .argument("<requestId>", "HTTP Request ID")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (
      requestId: string,
      options: {
        env?: string;
        environment?: string;
        output: OutputFormat;
      }
    ) => {
      requireAuth();

      let envName: string;
      try {
        envName = resolveEnvName(getEnvOption(options));
      } catch (error) {
        terminal.red(
          `${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exitCode = 1;
        return;
      }

      try {
        const baseUrl = getBaseUrl();
        const apiKey = getApiKey();

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/http-requests/${requestId}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            terminal.red(`HTTP request '${requestId}' not found\n`);
          } else {
            terminal.red(
              `Get HTTP request failed: HTTP ${response.status} ${response.statusText}\n`
            );
          }
          process.exitCode = 1;
          return;
        }

        const req = (await response.json()) as {
          id: string;
          method: string;
          url: string;
          headers: Record<string, string> | null;
          body: string | null;
          status: string;
          statusCode: number | null;
          statusText: string | null;
          responseHeaders: Record<string, string> | null;
          responseBody: string | null;
          createdAt: string;
          startedAt: string | null;
          endedAt: string | null;
          size: number;
        };

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(req, null, 2)}\n`);
        } else {
          // Calculate duration
          let duration = "";
          if (req.startedAt && req.endedAt) {
            const ms =
              new Date(req.endedAt).getTime() -
              new Date(req.startedAt).getTime();
            duration = `${ms}ms`;
          }

          terminal.bold("=== HTTP Request Details ===\n\n");

          // Status and timing
          const statusColor =
            req.status === "SUCCEEDED"
              ? terminal.green
              : req.status === "FAILED"
              ? terminal.red
              : terminal.yellow;
          terminal("Status:   ");
          statusColor(`${req.status}\n`);
          terminal(`Created:  ${req.createdAt}\n`);
          if (duration) {
            terminal(`Duration: ${duration}\n`);
          }
          terminal("\n");

          // Request
          terminal.bold("--- Request ---\n");
          terminal.cyan(`${req.method} ${req.url}\n`);
          if (req.headers && Object.keys(req.headers).length > 0) {
            terminal("\nHeaders:\n");
            for (const [key, value] of Object.entries(req.headers)) {
              // Redact auth headers
              const displayValue =
                key.toLowerCase() === "authorization"
                  ? value.substring(0, 15) + "..."
                  : value;
              terminal.gray(`  ${key}: ${displayValue}\n`);
            }
          }
          if (req.body) {
            terminal("\nBody:\n");
            try {
              const parsed = JSON.parse(req.body);
              terminal.gray(`${JSON.stringify(parsed, null, 2)}\n`);
            } catch {
              terminal.gray(`${req.body}\n`);
            }
          }
          terminal("\n");

          // Response
          terminal.bold("--- Response ---\n");
          if (req.statusCode) {
            const respColor =
              req.statusCode >= 200 && req.statusCode < 300
                ? terminal.green
                : req.statusCode >= 400
                ? terminal.red
                : terminal.yellow;
            respColor(`${req.statusCode} ${req.statusText ?? ""}\n`);
          } else {
            terminal.gray("(no response)\n");
          }
          if (
            req.responseHeaders &&
            Object.keys(req.responseHeaders).length > 0
          ) {
            terminal("\nHeaders:\n");
            for (const [key, value] of Object.entries(req.responseHeaders)) {
              terminal.gray(`  ${key}: ${value}\n`);
            }
          }
          if (req.responseBody) {
            terminal("\nBody:\n");
            try {
              const parsed = JSON.parse(req.responseBody);
              // Truncate large responses
              const str = JSON.stringify(parsed, null, 2);
              if (str.length > 2000) {
                terminal.gray(`${str.substring(0, 2000)}...\n`);
                terminal.gray(`(truncated, ${str.length} bytes total)\n`);
              } else {
                terminal.gray(`${str}\n`);
              }
            } catch {
              if (req.responseBody.length > 2000) {
                terminal.gray(`${req.responseBody.substring(0, 2000)}...\n`);
                terminal.gray(
                  `(truncated, ${req.responseBody.length} bytes total)\n`
                );
              } else {
                terminal.gray(`${req.responseBody}\n`);
              }
            }
          }

          if (req.size) {
            terminal.gray(`\nResponse size: ${req.size} bytes\n`);
          }
        }
      } catch (error) {
        terminal.red(
          `${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exitCode = 1;
      }
    }
  );
