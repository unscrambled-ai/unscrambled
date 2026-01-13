import { Command, Option, program } from "commander";
import { terminal } from "terminal-kit";

import { requireAuth } from "../../shared/requireAuth";
import { getApiKey } from "../../shared/getApiKey";
import { getBaseUrl } from "../../shared/getBaseUrl";
import { getEnvName } from "../../shared/getEnvName";
import { checkResponseOk, parseJsonResponse } from "../../shared/parseJsonResponse";

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

export const runs = new Command("runs").description(
  "Inspect action runs and logs"
);

// List runs
runs
  .command("list")
  .description("List recent runs")
  .addOption(new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)"))
  .addOption(new Option("-a, --action <name>", "Filter by action name"))
  .addOption(new Option("--sync <syncId>", "Filter by sync ID"))
  .addOption(new Option("--status <status>", "Filter by status (QUEUED, RUNNING, SUCCEEDED, FAILED, SKIPPED, CANCELED)"))
  .addOption(new Option("-l, --limit <count>", "Max number of runs to return").default("20"))
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (options: {
      env?: string;
      environment?: string;
      action?: string;
      sync?: string;
      status?: string;
      limit: string;
      output: OutputFormat;
    }) => {
      requireAuth();

      let envName: string;
      try {
        envName = resolveEnvName(getEnvOption(options));
      } catch (error) {
        terminal.red(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
        return;
      }

      try {
        const baseUrl = getBaseUrl();
        const apiKey = getApiKey();

        const params = new URLSearchParams();
        if (options.action) params.set("actionName", options.action);
        if (options.sync) params.set("syncId", options.sync);
        if (options.status) params.set("runStatus", options.status);

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/runs?${params}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          checkResponseOk(response, "List runs");
          throw new Error(`List runs failed: HTTP ${response.status} ${response.statusText}`);
        }

        const result = await parseJsonResponse(response, { operationName: "list runs" });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          const runs = result.runs ?? [];
          if (runs.length === 0) {
            terminal("No runs found\n");
            return;
          }

          terminal.bold(`Recent runs:\n\n`);
          const limit = parseInt(options.limit, 10);
          for (const r of runs.slice(0, limit)) {
            const statusColor =
              r.status === "SUCCEEDED" ? terminal.green :
              r.status === "FAILED" ? terminal.red :
              r.status === "RUNNING" ? terminal.cyan :
              r.status === "CANCELED" || r.status === "SKIPPED" ? terminal.yellow :
              terminal;

            terminal.bold(`${r.id}`);
            terminal(` ${r.action?.name || "?"} `);
            statusColor(`${r.status}`);
            if (r.managedUser) {
              terminal.gray(` (${r.managedUser.displayName || r.managedUser.externalId})`);
            }
            terminal("\n");
            terminal.gray(`  created: ${r.createdAt}`);
            if (r.endedAt) {
              const duration = new Date(r.endedAt).getTime() - new Date(r.createdAt).getTime();
              terminal.gray(` duration: ${(duration / 1000).toFixed(1)}s`);
            }
            terminal("\n");
            if (r.syncRunNumber !== null && r.syncRunNumber !== undefined) {
              terminal.gray(`  sync run #${r.syncRunNumber}\n`);
            }
            terminal("\n");
          }

          terminal(`Showing ${Math.min(runs.length, limit)} of ${runs.length} runs\n`);
          if (result.cursor) {
            terminal.gray(`(more available)\n`);
          }
        }
      } catch (error) {
        terminal.red(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  );

// Get logs for a run
runs
  .command("logs")
  .description("Get logs for a specific run")
  .argument("<runId>", "Run ID")
  .addOption(new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)"))
  .addOption(new Option("--level <level>", "Filter by log level (DEBUG, INFO, WARN, ERROR)"))
  .addOption(new Option("-l, --limit <count>", "Max logs to return").default("500"))
  .addOption(new Option("-s, --search <pattern>", "Filter logs containing pattern"))
  .addOption(new Option("--after <timestamp>", "Show logs after this timestamp (ISO 8601 or HH:MM:SS)"))
  .addOption(new Option("--before <timestamp>", "Show logs before this timestamp (ISO 8601 or HH:MM:SS)"))
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (
      runId: string,
      options: {
        env?: string;
        environment?: string;
        level?: string;
        limit: string;
        search?: string;
        after?: string;
        before?: string;
        output: OutputFormat;
      }
    ) => {
      requireAuth();

      let envName: string;
      try {
        envName = resolveEnvName(getEnvOption(options));
      } catch (error) {
        terminal.red(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
        return;
      }

      try {
        const baseUrl = getBaseUrl();
        const apiKey = getApiKey();

        // Build query params for date filtering
        const params = new URLSearchParams();
        if (options.after) {
          // Support both ISO 8601 and HH:MM:SS formats
          const afterTs = options.after.includes("T") 
            ? options.after 
            : `${new Date().toISOString().split("T")[0]}T${options.after}Z`;
          params.set("fromTimestamp", afterTs);
        }
        if (options.before) {
          const beforeTs = options.before.includes("T")
            ? options.before
            : `${new Date().toISOString().split("T")[0]}T${options.before}Z`;
          params.set("toTimestamp", beforeTs);
        }
        if (options.level) {
          params.set("level", options.level.toUpperCase());
        }
        params.set("size", options.limit);

        const queryString = params.toString();
        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/logs/run/${runId}${queryString ? `?${queryString}` : ""}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            terminal.red(`Run '${runId}' not found\n`);
            process.exitCode = 1;
            return;
          }
          checkResponseOk(response, "Get run logs");
          throw new Error(`Get run logs failed: HTTP ${response.status} ${response.statusText}`);
        }

        const result = await parseJsonResponse(response, { operationName: "get run logs" });

        const logs = result.data?.logs ?? result.logs ?? [];
        const totalCount = result.data?.pagination?.totalCount ?? logs.length;

        // Client-side filtering (level and date range are now server-side)
        let filteredLogs = logs;
        if (options.search) {
          const searchLower = options.search.toLowerCase();
          filteredLogs = filteredLogs.filter((log: any) =>
            log.message.toLowerCase().includes(searchLower)
          );
        }

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify({ logs: filteredLogs, totalCount }, null, 2)}\n`);
        } else {
          if (filteredLogs.length === 0) {
            terminal("No logs found\n");
            return;
          }

          terminal.bold(`Logs for run ${runId}:\n\n`);

          for (const log of filteredLogs) {
            const time = new Date(log.timestamp).toISOString().substring(11, 23);
            const levelColor =
              log.level === "ERROR" ? terminal.red :
              log.level === "WARN" ? terminal.yellow :
              log.level === "DEBUG" ? terminal.gray :
              terminal;
            levelColor(`[${time}] [${log.level.padEnd(5)}] ${log.message}\n`);
          }

          terminal(`\nShowing ${filteredLogs.length} of ${totalCount} logs\n`);
        }
      } catch (error) {
        terminal.red(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  );

// Get a single run
runs
  .command("get")
  .description("Get details for a specific run")
  .argument("<runId>", "Run ID")
  .addOption(new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)"))
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (
      runId: string,
      options: { env?: string; environment?: string; output: OutputFormat }
    ) => {
      requireAuth();

      let envName: string;
      try {
        envName = resolveEnvName(getEnvOption(options));
      } catch (error) {
        terminal.red(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
        return;
      }

      try {
        const baseUrl = getBaseUrl();
        const apiKey = getApiKey();

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/runs/${runId}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            terminal.red(`Run '${runId}' not found\n`);
            process.exitCode = 1;
            return;
          }
          checkResponseOk(response, "Get run");
          throw new Error(`Get run failed: HTTP ${response.status} ${response.statusText}`);
        }

        const r = await parseJsonResponse(response, { operationName: "get run" });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
        } else {
          const statusColor =
            r.status === "SUCCEEDED" ? terminal.green :
            r.status === "FAILED" ? terminal.red :
            r.status === "RUNNING" ? terminal.cyan :
            terminal;

          terminal.bold(`Run: ${r.id}\n\n`);
          terminal(`Action: ${r.action?.name || "?"} (${r.action?.title || "?"})\n`);
          terminal(`Status: `);
          statusColor(`${r.status}\n`);
          terminal(`Created: ${r.createdAt}\n`);
          if (r.startedAt) terminal(`Started: ${r.startedAt}\n`);
          if (r.endedAt) terminal(`Ended: ${r.endedAt}\n`);

          if (r.managedUser) {
            terminal(`\nManaged User:\n`);
            terminal(`  ${r.managedUser.displayName || r.managedUser.externalId}\n`);
            terminal.gray(`  ID: ${r.managedUser.id}\n`);
          }

          if (r.integration) {
            terminal(`\nIntegration: ${r.integration.name} (${r.integration.title})\n`);
          }

          if (r.apps && r.apps.length > 0) {
            terminal(`\nApps: ${r.apps.map((a: any) => a.name).join(", ")}\n`);
          }

          if (r.customApps && r.customApps.length > 0) {
            terminal(`Custom Apps: ${r.customApps.map((a: any) => a.name).join(", ")}\n`);
          }

          if (r.syncRunNumber !== null && r.syncRunNumber !== undefined) {
            terminal(`\nSync Run Number: ${r.syncRunNumber}\n`);
          }
        }
      } catch (error) {
        terminal.red(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  );
