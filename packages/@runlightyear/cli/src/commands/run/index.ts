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
  .addOption(new Option("-s, --search <pattern>", "Search indexed logs containing pattern (excludes very recent logs)"))
  .addOption(new Option("--after <timestamp>", "Show logs after this timestamp (ISO 8601 or HH:MM:SS)"))
  .addOption(new Option("--before <timestamp>", "Show logs before this timestamp (ISO 8601 or HH:MM:SS)"))
  .addOption(new Option("-t, --tail", "Show most recent logs first (descending order)"))
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
        tail?: boolean;
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

        // Build query params
        const params = new URLSearchParams();
        
        // When search is specified, use search mode (queries OpenSearch directly)
        // Otherwise use default live mode (Redis first, then OpenSearch)
        if (options.search) {
          params.set("mode", "search");
          params.set("search", options.search);
          // Note: search mode only queries indexed logs (OpenSearch)
          // Very recent logs (< ~2 min) may not appear in search results
        }
        
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
        if (options.tail) {
          params.set("sortOrder", "desc");
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

        let logs = result.data?.logs ?? result.logs ?? [];
        const totalCount = result.data?.pagination?.totalCount ?? logs.length;

        // Sort logs by timestamp only for non-search mode (search mode handles sorting server-side)
        if (!options.search) {
          logs.sort((a: any, b: any) => {
            const cmp = a.timestamp.localeCompare(b.timestamp);
            return options.tail ? -cmp : cmp;
          });
        }

        // No more client-side filtering needed - all filtering is done server-side
        const filteredLogs = logs;

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
          if (options.search) {
            terminal.gray(`Note: Search queries indexed logs. Very recent logs (< ~2 min) may not appear.\n`);
          }
        }
      } catch (error) {
        terminal.red(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  );

// Cancel a run
runs
  .command("cancel")
  .description("Cancel a running or queued run")
  .argument("<runId>", "Run ID")
  .addOption(new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)"))
  .addOption(new Option("-f, --force", "Skip confirmation prompt"))
  .action(
    async (
      runId: string,
      options: { env?: string; environment?: string; force?: boolean }
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

        // First get the run to show current status
        const getResponse = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/runs/${runId}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!getResponse.ok) {
          if (getResponse.status === 404) {
            terminal.red(`Run '${runId}' not found\n`);
            process.exitCode = 1;
            return;
          }
          checkResponseOk(getResponse, "Get run");
          throw new Error(`Get run failed: HTTP ${getResponse.status} ${getResponse.statusText}`);
        }

        const run = await parseJsonResponse(getResponse, { operationName: "get run" });

        terminal(`Run ${runId}\n`);
        terminal(`Action: ${run.action?.name || "(unknown)"}\n`);
        terminal(`Status: ${run.status}\n`);
        if (run.managedUser) {
          terminal(`User: ${run.managedUser.displayName || run.managedUser.externalId}\n`);
        }
        terminal("\n");

        // Check if already in terminal state
        if (["SUCCEEDED", "FAILED", "CANCELED", "SKIPPED"].includes(run.status)) {
          terminal.yellow(`Run has already ended with status: ${run.status}\n`);
          return;
        }

        if (!options.force) {
          terminal.yellow("Are you sure you want to cancel this run? [y/N] ");
          const input = await new Promise<string>((resolve) => {
            terminal.inputField({}, (error, input) => {
              resolve(input || "");
            });
          });
          terminal("\n");

          if (input.toLowerCase() !== "y" && input.toLowerCase() !== "yes") {
            terminal("Aborted.\n");
            return;
          }
        }

        terminal("Canceling run...\n");

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/runs/${runId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: "CANCELED" }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as { message?: string };
          terminal.red(`Cancel failed: ${errorData.message || response.statusText}\n`);
          process.exitCode = 1;
          return;
        }

        terminal.green("Run canceled successfully.\n");
      } catch (error) {
        terminal.red(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  );

// Analyze runs for a sync (show transition gaps)
runs
  .command("analyze")
  .description("Analyze run transitions for a sync")
  .argument("<syncId>", "Sync ID to analyze")
  .addOption(new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)"))
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (
      syncId: string,
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

        const params = new URLSearchParams();
        params.set("syncId", syncId);

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
        const runs = (result.runs ?? []).sort(
          (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        if (runs.length === 0) {
          terminal("No runs found for this sync\n");
          return;
        }

        // Calculate transitions
        const transitions: Array<{
          fromRun: number;
          toRun: number;
          fromEnded: string;
          toStarted: string;
          gapMs: number;
        }> = [];

        for (let i = 0; i < runs.length - 1; i++) {
          const curr = runs[i];
          const next = runs[i + 1];
          if (curr.endedAt && next.startedAt) {
            const gapMs = new Date(next.startedAt).getTime() - new Date(curr.endedAt).getTime();
            transitions.push({
              fromRun: i,
              toRun: i + 1,
              fromEnded: curr.endedAt,
              toStarted: next.startedAt,
              gapMs,
            });
          }
        }

        if (options.output === "json") {
          process.stdout.write(
            JSON.stringify(
              {
                syncId,
                runs: runs.map((r: any, i: number) => ({
                  runNumber: i,
                  id: r.id,
                  status: r.status,
                  createdAt: r.createdAt,
                  startedAt: r.startedAt,
                  endedAt: r.endedAt,
                  durationMs: r.endedAt && r.startedAt
                    ? new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime()
                    : null,
                })),
                transitions,
                summary: {
                  totalRuns: runs.length,
                  totalGapMs: transitions.reduce((sum, t) => sum + t.gapMs, 0),
                  avgGapMs: transitions.length > 0
                    ? transitions.reduce((sum, t) => sum + t.gapMs, 0) / transitions.length
                    : 0,
                  maxGapMs: transitions.length > 0 ? Math.max(...transitions.map(t => t.gapMs)) : 0,
                },
              },
              null,
              2
            ) + "\n"
          );
        } else {
          terminal.bold(`Run Transition Analysis for Sync ${syncId}\n\n`);

          terminal.bold("Runs:\n");
          for (let i = 0; i < runs.length; i++) {
            const r = runs[i];
            const duration = r.endedAt && r.startedAt
              ? (new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime()) / 1000
              : null;
            terminal(`  #${i}: ${r.id.substring(0, 13)}...`);
            terminal(` ${r.status}`);
            if (duration !== null) {
              terminal(` (${duration.toFixed(1)}s)`);
            }
            terminal("\n");
            terminal.gray(`      started: ${r.startedAt?.substring(11, 23) || "?"}`);
            terminal.gray(` ended: ${r.endedAt?.substring(11, 23) || "?"}\n`);
          }

          terminal("\n");
          terminal.bold("Transitions:\n");
          for (const t of transitions) {
            const gapSec = t.gapMs / 1000;
            const isSlowGap = gapSec > 5;
            terminal(`  Run #${t.fromRun} → #${t.toRun}: `);
            if (isSlowGap) {
              terminal.red(`${gapSec.toFixed(2)}s`);
              terminal.yellow(` ⚠️  SLOW\n`);
            } else {
              terminal.green(`${gapSec.toFixed(2)}s\n`);
            }
          }

          terminal("\n");
          terminal.bold("Summary:\n");
          const totalGapSec = transitions.reduce((sum, t) => sum + t.gapMs, 0) / 1000;
          const avgGapSec = transitions.length > 0 ? totalGapSec / transitions.length : 0;
          const maxGapSec = transitions.length > 0 ? Math.max(...transitions.map(t => t.gapMs)) / 1000 : 0;
          terminal(`  Total runs: ${runs.length}\n`);
          terminal(`  Total gap time: ${totalGapSec.toFixed(2)}s\n`);
          terminal(`  Avg gap: ${avgGapSec.toFixed(2)}s\n`);
          terminal(`  Max gap: ${maxGapSec.toFixed(2)}s`);
          if (maxGapSec > 5) {
            terminal.yellow(` ⚠️\n`);
          } else {
            terminal("\n");
          }
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
