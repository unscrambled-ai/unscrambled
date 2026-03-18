import { Command, Option, program } from "commander";
import { terminal } from "terminal-kit";

import { requireAuth } from "../../shared/requireAuth";
import { getApiKey } from "../../shared/getApiKey";
import { getBaseUrl } from "../../shared/getBaseUrl";
import { getEnvName } from "../../shared/getEnvName";
import {
  checkResponseOk,
  parseJsonResponse,
} from "../../shared/parseJsonResponse";

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

async function fetchSync(envName: string, syncId: string) {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();

  const response = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/syncs/${syncId}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    checkResponseOk(response, "Get sync");
    await parseJsonResponse(response, { operationName: "get sync" }).catch(
      () => undefined
    );
    throw new Error(
      `Get sync failed: HTTP ${response.status} ${response.statusText}`
    );
  }

  return await parseJsonResponse(response, { operationName: "get sync" });
}

async function fetchSyncStats(envName: string, syncId: string) {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();

  const response = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/syncs/${syncId}/stats`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    return null; // Stats endpoint may not exist or have data
  }

  return await parseJsonResponse(response, { operationName: "get sync stats" });
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatTimestamp(dateStr: string | null | undefined): string {
  if (!dateStr) return "(not set)";
  const date = new Date(dateStr);
  return date.toISOString().replace("T", " ").substring(0, 19) + " UTC";
}

function printSyncText(envName: string, sync: any, stats?: any) {
  const status = sync.status;
  const type = sync.type ?? "(unknown)";
  const direction = sync.currentDirection ?? "(none)";
  const currentModel = sync.currentModel?.name ?? "(none)";

  // Calculate duration and throughput
  let durationStr = "";
  let throughputStr = "";
  if (sync.startedAt && sync.endedAt) {
    const durationMs =
      new Date(sync.endedAt).getTime() - new Date(sync.startedAt).getTime();
    durationStr = formatDuration(durationMs);
    const totalItems = sync.succeeded ?? 0;
    if (durationMs > 0 && totalItems > 0) {
      const itemsPerSec = (totalItems / (durationMs / 1000)).toFixed(0);
      throughputStr = ` (${itemsPerSec} objects/sec)`;
    }
  } else if (sync.startedAt && !sync.endedAt) {
    // Still running - show elapsed time
    const elapsedMs = Date.now() - new Date(sync.startedAt).getTime();
    durationStr = `${formatDuration(elapsedMs)} (running)`;
  }

  terminal.bold(`Sync ${sync.id}\n`);
  terminal(`env: ${envName}\n`);
  terminal(`status: ${status}  type: ${type}\n`);
  if (durationStr) {
    terminal(`duration: ${durationStr}${throughputStr}\n`);
  }
  terminal(`current: ${currentModel} / ${direction}\n`);

  if (sync.error) {
    terminal.red(`error: ${sync.error}\n`);
  }

  // Timestamps section
  terminal("\n");
  terminal.bold("Timestamps:\n");
  terminal(`  created:  ${formatTimestamp(sync.createdAt)}\n`);
  terminal(`  started:  ${formatTimestamp(sync.startedAt)}\n`);
  terminal(`  ended:    ${formatTimestamp(sync.endedAt)}\n`);

  terminal("\n");
  terminal(
    `Counts: queued=${sync.queued ?? 0} processing=${
      sync.processing ?? 0
    } succeeded=${sync.succeeded ?? 0} failed=${sync.failed ?? 0} canceled=${
      sync.canceled ?? 0
    } total=${sync.total ?? 0}\n`
  );

  // Stats breakdown by model if available
  if (stats) {
    const models = stats.models ?? stats.byModel ?? {};
    if (typeof models === "object" && Object.keys(models).length > 0) {
      terminal("\n");
      terminal.bold("By Model:\n");
      for (const [modelName, modelStats] of Object.entries(models) as Array<
        [string, any]
      >) {
        terminal(`  ${modelName}:\n`);
        if (modelStats.pull) {
          const pullSucceeded = modelStats.pull.succeeded ?? 0;
          const pullFailed = modelStats.pull.failed ?? 0;
          terminal(
            `    PULL: ${pullSucceeded} succeeded, ${pullFailed} failed\n`
          );
        }
        if (modelStats.push) {
          const pushSucceeded = modelStats.push.succeeded ?? 0;
          const pushFailed = modelStats.push.failed ?? 0;
          terminal(
            `    PUSH: ${pushSucceeded} succeeded, ${pushFailed} failed\n`
          );
        }
        if (!modelStats.pull && !modelStats.push) {
          // Flat stats without direction breakdown
          terminal(
            `    total: ${modelStats.total ?? 0}, succeeded: ${
              modelStats.succeeded ?? 0
            }, failed: ${modelStats.failed ?? 0}\n`
          );
        }
      }
    }
  }

  if (sync.lastBatch) {
    const modelPart = sync.lastBatch.modelName
      ? ` model=${sync.lastBatch.modelName}`
      : "";
    terminal(
      `lastBatch: ${sync.lastBatch.id} (${sync.lastBatch.type} ${sync.lastBatch.status}${modelPart})\n`
    );
  }

  if (sync.initialRun) {
    terminal(
      `initialRun: ${sync.initialRun.id} (action=${
        sync.initialRun.action?.name ?? "(unknown)"
      })\n`
    );
  }

  if (sync.modelStatuses && typeof sync.modelStatuses === "object") {
    const entries = Object.entries(sync.modelStatuses) as Array<
      [
        string,
        {
          lastExternalId: string | null;
          lastExternalUpdatedAt: string | null;
          cursor: string | null;
          page: number | null;
          offset: number | null;
          readOnly: boolean;
          writeOnly: boolean;
        }
      ]
    >;

    if (entries.length > 0) {
      terminal("\nmodelStatuses:\n");
      for (const [modelName, ms] of entries) {
        const flags = [
          ms.readOnly ? "readOnly" : null,
          ms.writeOnly ? "writeOnly" : null,
        ]
          .filter(Boolean)
          .join(", ");
        const resume =
          ms.cursor != null
            ? `cursor=${ms.cursor}`
            : ms.page != null
            ? `page=${ms.page}`
            : ms.offset != null
            ? `offset=${ms.offset}`
            : "";

        const parts = [
          `- ${modelName}${flags ? ` (${flags})` : ""}: ${resume}`.trim(),
        ];
        if (ms.lastExternalId)
          parts.push(`lastExternalId=${ms.lastExternalId}`);
        if (ms.lastExternalUpdatedAt)
          parts.push(`lastExternalUpdatedAt=${ms.lastExternalUpdatedAt}`);
        terminal(`${parts.join(" ")}\n`);
      }
    }
  }
}

async function fetchCollectionObjectCounts(
  envName: string,
  collectionName: string
) {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();

  const response = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/collections/${collectionName}/stats`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    // Fallback: try listing objects to count
    return null;
  }

  return await parseJsonResponse(response, {
    operationName: "get collection stats",
  });
}

export const syncs = new Command("syncs").description(
  "Inspect and manage syncs"
);

syncs
  .command("get")
  .description("Get a sync by ID")
  .argument("<syncId>", "Sync ID")
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
      syncId: string,
      options: { env?: string; environment?: string; output: OutputFormat }
    ) => {
      requireAuth();

      const globalOptions = program.opts();
      if (globalOptions.debug) {
        terminal.gray("DEBUG enabled\n");
      }

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
        const [result, stats] = await Promise.all([
          fetchSync(envName, syncId),
          fetchSyncStats(envName, syncId),
        ]);
        if (options.output === "json") {
          // Include stats in JSON output if available
          const output = stats ? { ...result, stats } : result;
          process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
        } else {
          printSyncText(envName, result, stats);
        }
      } catch (error) {
        terminal.red(
          `${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exitCode = 1;
      }
    }
  );

syncs
  .command("batches")
  .description("List batches in a sync")
  .argument("<syncId>", "Sync ID")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(
    new Option(
      "-l, --limit <count>",
      "Max number of batches to return"
    ).default("100")
  )
  .addOption(
    new Option(
      "--status <status>",
      "Filter by status (QUEUED, RUNNING, SUCCEEDED, FAILED)"
    )
  )
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (
      syncId: string,
      options: {
        env?: string;
        environment?: string;
        limit: string;
        status?: string;
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

        const params = new URLSearchParams();
        params.set("syncId", syncId);
        params.set("limit", options.limit);
        if (options.status) params.set("status", options.status);

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/batches?${params}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          checkResponseOk(response, "List batches");
          throw new Error(
            `List batches failed: HTTP ${response.status} ${response.statusText}`
          );
        }

        const result = (await parseJsonResponse(response, {
          operationName: "list batches",
        })) as {
          summary: {
            total: number;
            byStatus: Record<string, number>;
            byType: Record<string, number>;
          };
          batches: Array<{
            id: string;
            syncId: string | null;
            type: string;
            status: string;
            modelName: string | null;
            createdAt: string;
            startedAt: string | null;
            endedAt: string | null;
          }>;
        };

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          const { summary, batches } = result;

          terminal.bold(`Batches for sync ${syncId}:\n\n`);

          // Show summary
          terminal.bold("Summary:\n");
          terminal(`  Total: ${summary.total}\n`);
          terminal(
            `  By Status: ${
              Object.entries(summary.byStatus)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ") || "(none)"
            }\n`
          );
          terminal(
            `  By Type: ${
              Object.entries(summary.byType)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ") || "(none)"
            }\n`
          );
          terminal("\n");

          if (batches.length === 0) {
            terminal("No batches found\n");
            return;
          }

          terminal.bold("Batches:\n");
          for (const batch of batches) {
            const statusColor =
              batch.status === "SUCCEEDED"
                ? terminal.green
                : batch.status === "FAILED"
                ? terminal.red
                : batch.status === "RUNNING"
                ? terminal.cyan
                : batch.status === "QUEUED"
                ? terminal.yellow
                : terminal;

            terminal(`  ${batch.id} `);
            terminal(`${batch.type.padEnd(10)} `);
            statusColor(`${batch.status.padEnd(10)}`);
            terminal(` model=${batch.modelName ?? "(none)"}`);
            if (batch.startedAt && batch.endedAt) {
              const durationMs =
                new Date(batch.endedAt).getTime() -
                new Date(batch.startedAt).getTime();
              terminal.gray(` ${durationMs}ms`);
            }
            terminal("\n");
          }

          if (batches.length < summary.total) {
            terminal.gray(
              `\nShowing ${batches.length} of ${summary.total} batches\n`
            );
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

syncs
  .command("stats")
  .description("Show item counts per model and direction for a sync")
  .argument("<syncId>", "Sync ID")
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
      syncId: string,
      options: { env?: string; environment?: string; output: OutputFormat }
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
          `${baseUrl}/api/v1/projects/default/envs/${envName}/syncs/${syncId}/stats`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          checkResponseOk(response, "Get sync stats");
          throw new Error(
            `Get sync stats failed: HTTP ${response.status} ${response.statusText}`
          );
        }

        const result = await parseJsonResponse(response, {
          operationName: "get sync stats",
        });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          terminal.bold(`Stats for sync ${syncId}:\n\n`);

          const models = result.models ?? result.byModel ?? {};
          if (typeof models === "object" && Object.keys(models).length > 0) {
            for (const [modelName, stats] of Object.entries(models) as Array<
              [string, any]
            >) {
              terminal.bold(`${modelName}:\n`);
              if (stats.pull) {
                terminal(
                  `  PULL: queued=${stats.pull.queued ?? 0} succeeded=${
                    stats.pull.succeeded ?? 0
                  } failed=${stats.pull.failed ?? 0} total=${
                    stats.pull.total ?? 0
                  }\n`
                );
              }
              if (stats.push) {
                terminal(
                  `  PUSH: queued=${stats.push.queued ?? 0} succeeded=${
                    stats.push.succeeded ?? 0
                  } failed=${stats.push.failed ?? 0} total=${
                    stats.push.total ?? 0
                  }\n`
                );
              }
              if (!stats.pull && !stats.push) {
                terminal(
                  `  total=${stats.total ?? 0} succeeded=${
                    stats.succeeded ?? 0
                  } failed=${stats.failed ?? 0}\n`
                );
              }
            }
          } else {
            terminal("No model stats available\n");
          }

          if (result.totals) {
            terminal(
              `\nTotals: queued=${result.totals.queued ?? 0} succeeded=${
                result.totals.succeeded ?? 0
              } failed=${result.totals.failed ?? 0} total=${
                result.totals.total ?? 0
              }\n`
            );
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

syncs
  .command("items")
  .description("List items in a sync or batch")
  .argument("<syncId>", "Sync ID")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(new Option("-b, --batch <batchId>", "Filter by batch ID"))
  .addOption(new Option("--model <name>", "Filter by model name"))
  .addOption(
    new Option(
      "--status <status>",
      "Filter by status (QUEUED, PROCESSING, SUCCEEDED, FAILED)"
    )
  )
  .addOption(
    new Option("-l, --limit <count>", "Max number of items to return").default(
      "20"
    )
  )
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (
      syncId: string,
      options: {
        env?: string;
        environment?: string;
        batch?: string;
        model?: string;
        status?: string;
        limit: string;
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

        const params = new URLSearchParams();
        params.set("limit", options.limit);
        if (options.batch) params.set("batchId", options.batch);
        if (options.model) params.set("modelName", options.model);
        if (options.status) params.set("status", options.status);

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/syncs/${syncId}/items?${params}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          checkResponseOk(response, "List sync items");
          throw new Error(
            `List sync items failed: HTTP ${response.status} ${response.statusText}`
          );
        }

        const result = await parseJsonResponse(response, {
          operationName: "list sync items",
        });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          const items = result.items ?? result.data ?? result ?? [];
          if (!Array.isArray(items) || items.length === 0) {
            terminal("No items found\n");
            return;
          }

          terminal.bold(`Items for sync ${syncId}:\n`);
          for (const item of items) {
            const externalId = item.externalId ?? item.id ?? "(?)";
            terminal(
              `  ${item.id ?? "?"} ${item.status ?? "?"} model=${
                item.modelName ?? "?"
              } externalId=${externalId}\n`
            );
            if (item.error) {
              terminal.red(`    error: ${item.error}\n`);
            }
          }
          terminal(`\nShowing ${items.length} items\n`);
        }
      } catch (error) {
        terminal.red(
          `${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exitCode = 1;
      }
    }
  );

syncs
  .command("delta")
  .description("Preview delta changes for a sync (what would be pushed)")
  .argument("<syncId>", "Sync ID")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(
    new Option(
      "--model <name>",
      "Model name to check delta for"
    ).makeOptionMandatory()
  )
  .addOption(
    new Option("-l, --limit <count>", "Max changes to return").default("10")
  )
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (
      syncId: string,
      options: {
        env?: string;
        environment?: string;
        model: string;
        limit: string;
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
        // First get the sync to find the collection name
        const syncData = await fetchSync(envName, syncId);
        const collectionName = syncData.collection?.name;

        if (!collectionName) {
          terminal.red("Could not determine collection name from sync\n");
          process.exitCode = 1;
          return;
        }

        const baseUrl = getBaseUrl();
        const apiKey = getApiKey();

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/collections/${collectionName}/delta`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              syncId,
              modelName: options.model,
              limit: parseInt(options.limit, 10),
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          terminal.red(
            `Get delta failed: HTTP ${response.status} ${response.statusText}\n`
          );
          if (errorText) terminal.red(`${errorText}\n`);
          process.exitCode = 1;
          return;
        }

        const result = await parseJsonResponse(response, {
          operationName: "get delta",
        });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          terminal.bold(
            `Delta for sync ${syncId}, model ${options.model}:\n\n`
          );
          terminal(`operation: ${result.operation ?? "(none)"}\n`);
          terminal(`changes: ${result.changes?.length ?? 0}\n\n`);

          if (result.changes && result.changes.length > 0) {
            for (const change of result.changes.slice(0, 10)) {
              terminal(`  - changeId: ${change.changeId}\n`);
              if (change.externalId)
                terminal(`    externalId: ${change.externalId}\n`);
              if (change.data) {
                const dataKeys = Object.keys(change.data).slice(0, 5);
                terminal(
                  `    data: { ${dataKeys
                    .map((k) => `${k}: ...`)
                    .join(", ")} }\n`
                );
              }
            }
            if (result.changes.length > 10) {
              terminal(`  ... and ${result.changes.length - 10} more\n`);
            }
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

syncs
  .command("logs")
  .description("Fetch logs for a sync")
  .argument("<syncId>", "Sync ID")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(
    new Option(
      "--level <level>",
      "Filter by log level (DEBUG, INFO, WARN, ERROR)"
    )
  )
  .addOption(
    new Option("-l, --limit <count>", "Max logs per run to fetch").default(
      "500"
    )
  )
  .addOption(
    new Option("-s, --search <pattern>", "Filter logs containing pattern")
  )
  .addOption(
    new Option(
      "--after <timestamp>",
      "Show logs after this timestamp (ISO 8601 or HH:MM:SS)"
    )
  )
  .addOption(
    new Option(
      "--before <timestamp>",
      "Show logs before this timestamp (ISO 8601 or HH:MM:SS)"
    )
  )
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (
      syncId: string,
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
        terminal.red(
          `${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exitCode = 1;
        return;
      }

      try {
        const baseUrl = getBaseUrl();
        const apiKey = getApiKey();

        // Build query params
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

        // Query sync logs directly via /logs/sync/{syncId}
        const logsUrl = `${baseUrl}/api/v1/projects/default/envs/${envName}/logs/sync/${syncId}${
          queryString ? `?${queryString}` : ""
        }`;
        const logsResponse = await fetch(logsUrl, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!logsResponse.ok) {
          if (logsResponse.status === 404) {
            terminal.red(`Sync '${syncId}' not found or has no logs\n`);
          } else {
            terminal.red(`Failed to fetch logs: HTTP ${logsResponse.status}\n`);
          }
          process.exitCode = 1;
          return;
        }

        const logsData = (await logsResponse.json()) as {
          data: {
            logs: Array<{
              id: string;
              timestamp: string;
              level: string;
              message: string;
            }>;
            pagination: { totalCount: number; hasMore?: boolean };
          };
        };
        const logs = logsData.data?.logs ?? [];
        const totalCount = logsData.data?.pagination?.totalCount ?? logs.length;
        const hasMore = logsData.data?.pagination?.hasMore ?? false;

        // Apply client-side search filter (server doesn't support text search)
        const filteredLogs = options.search
          ? logs.filter((log) =>
              log.message?.toLowerCase().includes(options.search!.toLowerCase())
            )
          : logs;

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(filteredLogs, null, 2)}\n`);
        } else {
          if (filteredLogs.length === 0) {
            terminal("No logs found for this sync\n");
            return;
          }

          for (const log of filteredLogs) {
            const time = new Date(log.timestamp)
              .toISOString()
              .substring(11, 23);
            const levelColor =
              log.level === "ERROR"
                ? terminal.red
                : log.level === "WARN"
                ? terminal.yellow
                : log.level === "DEBUG"
                ? terminal.gray
                : terminal;
            levelColor(
              `[${time}] [${log.level?.padEnd(5) ?? "     "}] ${
                log.message ?? ""
              }\n`
            );
          }

          terminal(
            `\nShowing ${filteredLogs.length} of ${totalCount} logs${
              hasMore ? " (more available)" : ""
            }\n`
          );
        }
      } catch (error) {
        terminal.red(
          `${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exitCode = 1;
      }
    }
  );

syncs
  .command("diagnose")
  .description(
    "Diagnose sync issues - show item counts, delta preview, and potential problems"
  )
  .argument("<syncId>", "Sync ID")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .action(
    async (syncId: string, options: { env?: string; environment?: string }) => {
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
        terminal.bold("=== Sync Diagnostic Report ===\n\n");

        // Get sync details
        const syncData = await fetchSync(envName, syncId);

        terminal.bold("1. Sync Status:\n");
        terminal(`   ID: ${syncData.id}\n`);
        terminal(`   Type: ${syncData.type}\n`);
        terminal(`   Status: ${syncData.status}\n`);
        terminal(
          `   Collection: ${syncData.collection?.name ?? "(unknown)"}\n`
        );
        terminal(
          `   Integration: ${
            syncData.customApp?.name ?? syncData.app?.name ?? "(unknown)"
          }\n`
        );
        terminal(
          `   Current Direction: ${syncData.currentDirection ?? "(none)"}\n`
        );
        terminal(
          `   Current Model: ${syncData.currentModel?.name ?? "(none)"}\n`
        );
        if (syncData.error) {
          terminal.red(`   Error: ${syncData.error}\n`);
        }
        terminal("\n");

        terminal.bold("2. Item Counts:\n");
        terminal(`   Total: ${syncData.total ?? 0}\n`);
        terminal(`   Succeeded: ${syncData.succeeded ?? 0}\n`);
        terminal(`   Failed: ${syncData.failed ?? 0}\n`);
        terminal(`   Queued: ${syncData.queued ?? 0}\n`);
        terminal(`   Processing: ${syncData.processing ?? 0}\n`);
        terminal(`   Canceled: ${syncData.canceled ?? 0}\n`);
        terminal("\n");

        terminal.bold("3. Model Progress:\n");
        const models = syncData.collection?.models ?? [];
        const modelStatuses = syncData.modelStatuses ?? {};

        for (const model of models) {
          const ms = modelStatuses[model.name];
          const status =
            ms?.cursor || ms?.page || ms?.offset
              ? "IN_PROGRESS"
              : ms?.lastExternalId
              ? "COMPLETED"
              : "NOT_STARTED";
          const flags = [
            ms?.readOnly ? "readOnly" : null,
            ms?.writeOnly ? "writeOnly" : null,
          ]
            .filter(Boolean)
            .join(", ");

          terminal(
            `   ${model.name}: ${status}${flags ? ` (${flags})` : ""}\n`
          );
          if (ms?.cursor) terminal(`      cursor: ${ms.cursor}\n`);
          if (ms?.lastExternalId)
            terminal(`      lastExternalId: ${ms.lastExternalId}\n`);
        }
        terminal("\n");

        // Check for potential issues
        terminal.bold("4. Potential Issues:\n");
        let issuesFound = false;

        // Check for high total count
        if (syncData.total > 100000) {
          terminal.yellow(
            `   ⚠️  High item count (${syncData.total}). This may indicate:\n`
          );
          terminal.yellow(
            `      - Bidirectional sync collision (multiple integrations sharing a collection)\n`
          );
          terminal.yellow(
            `      - Large dataset that needs pagination optimization\n`
          );
          issuesFound = true;
        }

        // Check for high failure rate
        const failureRate =
          syncData.total > 0 ? (syncData.failed / syncData.total) * 100 : 0;
        if (failureRate > 10) {
          terminal.yellow(
            `   ⚠️  High failure rate (${failureRate.toFixed(1)}%). Check:\n`
          );
          terminal.yellow(`      - API rate limits\n`);
          terminal.yellow(`      - Data validation errors\n`);
          terminal.yellow(`      - Authentication issues\n`);
          issuesFound = true;
        }

        // Check if stuck in PUSH phase with high count
        if (syncData.currentDirection === "PUSH" && syncData.total > 50000) {
          terminal.yellow(
            `   ⚠️  Sync stuck in PUSH phase with high item count.\n`
          );
          terminal.yellow(
            `      This often indicates delta calculation including items that shouldn't be pushed.\n`
          );
          terminal.yellow(
            `      Check if multiple integrations share the same collection.\n`
          );
          issuesFound = true;
        }

        if (!issuesFound) {
          terminal.green(`   ✅ No obvious issues detected\n`);
        }
        terminal("\n");

        terminal.bold("5. Recommendations:\n");
        terminal(
          `   - Run 'un sync delta ${syncId} --model <modelName>' to preview what changes are pending\n`
        );
        terminal(
          `   - Check if multiple integrations share the '${syncData.collection?.name}' collection\n`
        );
        terminal(`   - Consider using readOnly models for reference data\n`);
      } catch (error) {
        terminal.red(
          `${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exitCode = 1;
      }
    }
  );

syncs
  .command("wait")
  .description("Wait until a sync reaches a terminal state")
  .argument("<syncId>", "Sync ID")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(
    new Option(
      "--poll-interval <seconds>",
      "Polling interval in seconds"
    ).default("2")
  )
  .addOption(
    new Option("--timeout <seconds>", "Timeout in seconds").default("600")
  )
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (
      syncId: string,
      options: {
        env?: string;
        environment?: string;
        pollInterval: string;
        timeout: string;
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

      const pollIntervalMs = Math.max(Number(options.pollInterval) * 1000, 250);
      const timeoutMs = Math.max(Number(options.timeout) * 1000, 0);

      const terminalStatuses = new Set([
        "SUCCEEDED",
        "PARTIAL",
        "FAILED",
        "CANCELED",
        "SKIPPED",
      ]);

      const startedAt = Date.now();
      let lastStatus: string | null = null;

      while (true) {
        if (timeoutMs > 0 && Date.now() - startedAt > timeoutMs) {
          terminal.red(
            `Timed out waiting for sync ${syncId} after ${options.timeout}s\n`
          );
          process.exitCode = 1;
          return;
        }

        let result: any;
        try {
          result = await fetchSync(envName, syncId);
        } catch (error) {
          terminal.red(
            `${error instanceof Error ? error.message : String(error)}\n`
          );
          process.exitCode = 1;
          return;
        }

        const status: string = result.status;
        if (status !== lastStatus) {
          if (options.output === "json") {
            process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
          } else {
            terminal(`${new Date().toISOString()} status=${status}\n`);
          }
          lastStatus = status;
        }

        if (terminalStatuses.has(status)) {
          if (options.output !== "json") {
            terminal.green(`Sync ${syncId} finished with status ${status}\n`);
          }
          process.exitCode = status === "FAILED" ? 1 : 0;
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }
  );

syncs
  .command("list")
  .description("List syncs with optional filters")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(
    new Option(
      "--type <type>",
      "Filter by sync type (BASELINE, FULL, INCREMENTAL)"
    )
  )
  .addOption(
    new Option(
      "--status <status>",
      "Filter by status (QUEUED, RUNNING, SUCCEEDED, FAILED, etc.)"
    )
  )
  .addOption(new Option("--integration <name>", "Filter by integration name"))
  .addOption(
    new Option("-l, --limit <count>", "Max number of syncs to return").default(
      "20"
    )
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
      type?: string;
      status?: string;
      integration?: string;
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
        if (options.type) params.set("syncType", options.type);
        if (options.status) params.set("syncStatus", options.status);
        if (options.integration)
          params.set("integrationName", options.integration);

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/syncs?${params}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          checkResponseOk(response, "List syncs");
          throw new Error(
            `List syncs failed: HTTP ${response.status} ${response.statusText}`
          );
        }

        const result = await parseJsonResponse(response, {
          operationName: "list syncs",
        });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          const syncs = result.syncs ?? [];
          if (syncs.length === 0) {
            terminal("No syncs found\n");
            return;
          }

          // Helper for relative time
          const formatRelativeTime = (dateStr: string): string => {
            const date = new Date(dateStr);
            const now = Date.now();
            const diffMs = now - date.getTime();
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHour / 24);

            if (diffSec < 60) return "just now";
            if (diffMin < 60) return `${diffMin}m ago`;
            if (diffHour < 24) return `${diffHour}h ago`;
            if (diffDay < 7) return `${diffDay}d ago`;
            return date.toLocaleDateString();
          };

          terminal.bold(`Recent syncs:\n\n`);
          const limit = parseInt(options.limit, 10);
          for (const s of syncs.slice(0, limit)) {
            const integration =
              s.customApp?.name ||
              s.app?.name ||
              s.integration?.name ||
              "(unknown)";
            const statusColor =
              s.status === "SUCCEEDED"
                ? terminal.green
                : s.status === "FAILED"
                ? terminal.red
                : s.status === "RUNNING"
                ? terminal.cyan
                : s.status === "CANCELED"
                ? terminal.yellow
                : terminal;

            // Show full ID so it can be copied for watch command
            terminal.bold(`${s.id}`);
            terminal("\n");
            terminal(`  ${s.type || "?"} `);
            statusColor(`${s.status}`);
            terminal(` ${integration}`);
            if (s.managedUser) {
              terminal.gray(
                ` (${s.managedUser.displayName || s.managedUser.externalId})`
              );
            }
            terminal("\n");
            terminal.gray(
              `  items: ${s.total || 0} (${s.succeeded || 0} ok, ${
                s.failed || 0
              } failed)`
            );
            terminal.gray(` | ${formatRelativeTime(s.createdAt)}\n`);
            if (s.error) {
              terminal.red(`  error: ${s.error}\n`);
            }
            terminal("\n");
          }

          terminal(
            `Showing ${Math.min(syncs.length, limit)} of ${
              syncs.length
            } syncs\n`
          );
          if (result.cursor) {
            terminal.gray(`(more available)\n`);
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

syncs
  .command("cancel")
  .description("Cancel a running sync")
  .argument("<syncId>", "Sync ID")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(new Option("-f, --force", "Skip confirmation prompt"))
  .action(
    async (
      syncId: string,
      options: { env?: string; environment?: string; force?: boolean }
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

        // First get the sync to show current status
        const syncData = await fetchSync(envName, syncId);

        terminal(`Sync ${syncId}\n`);
        terminal(`Status: ${syncData.status}\n`);
        terminal(`Type: ${syncData.type || "(unknown)"}\n`);
        terminal(
          `Items: ${syncData.total || 0} total, ${
            syncData.succeeded || 0
          } succeeded, ${syncData.failed || 0} failed\n\n`
        );

        // Check if already ended
        if (
          ["SUCCEEDED", "PARTIAL", "FAILED", "CANCELED", "SKIPPED"].includes(
            syncData.status
          )
        ) {
          terminal.yellow(
            `Sync has already ended with status: ${syncData.status}\n`
          );
          return;
        }

        if (!options.force) {
          terminal.yellow("Are you sure you want to cancel this sync? [y/N] ");
          const input = await new Promise<string>((resolve) => {
            terminal.inputField({}, (error, input) => {
              resolve(input || "");
            });
          });
          terminal("\n");

          if (input.toLowerCase() !== "y" && input.toLowerCase() !== "yes") {
            terminal("Canceled.\n");
            return;
          }
        }

        terminal("Canceling sync...\n");

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/syncs/${syncId}/cancel`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          terminal.red(
            `Cancel failed: ${errorData.message || response.statusText}\n`
          );
          process.exitCode = 1;
          return;
        }

        terminal.green("Sync canceled successfully.\n");
      } catch (error) {
        terminal.red(
          `${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exitCode = 1;
      }
    }
  );

syncs
  .command("status")
  .description(
    "Show sync scheduling and processing status for this environment"
  )
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
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

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/syncs/status`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          checkResponseOk(response, "Get sync status");
          throw new Error(
            `Get sync status failed: HTTP ${response.status} ${response.statusText}`
          );
        }

        const result = await parseJsonResponse(response, {
          operationName: "get sync status",
        });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          terminal.bold("=== Sync Status ===\n\n");

          // Scheduling status
          terminal.bold("Scheduling:\n");
          const scheduling = result.scheduling;
          if (scheduling?.paused) {
            terminal.yellow("  Status: PAUSED\n");
          } else {
            terminal.green("  Status: Active\n");
          }

          if (scheduling?.schedules && scheduling.schedules.length > 0) {
            terminal("\n  Configured schedules:\n");
            for (const sched of scheduling.schedules) {
              const interval = sched.intervalMinutes
                ? `every ${sched.intervalMinutes} min`
                : "(on-demand)";
              terminal(
                `    ${sched.integrationName}: ${sched.type} ${interval}\n`
              );
            }
          } else {
            terminal.gray("  No schedules configured\n");
          }

          terminal("\n");

          // Active syncs
          terminal.bold("Active Syncs:\n");
          const active = result.activeSyncs;
          if (active && (active.running > 0 || active.finishing > 0)) {
            terminal(`  RUNNING: ${active.running ?? 0}\n`);
            terminal(`  FINISHING: ${active.finishing ?? 0}\n`);
          } else {
            terminal.gray("  None\n");
          }

          terminal("\n");

          // Pending syncs
          terminal.bold("Pending Syncs:\n");
          const pending = result.pendingSyncs;
          if (pending && pending.total > 0) {
            terminal(`  QUEUED: ${pending.queued ?? 0}\n`);
            terminal(`  DELAYED: ${pending.delayed ?? 0}\n`);
            terminal(`  CONTINUING: ${pending.continuing ?? 0}\n`);

            if (pending.syncs && pending.syncs.length > 0) {
              terminal("\n  Details:\n");
              for (const sync of pending.syncs.slice(0, 10)) {
                const statusColor =
                  sync.status === "CONTINUING"
                    ? terminal.yellow
                    : sync.status === "DELAYED"
                    ? terminal.yellow
                    : terminal;
                terminal(`    ${sync.id} `);
                statusColor(`${sync.status}`);
                terminal(
                  ` ${sync.type} ${sync.integrationName || "(unknown)"}`
                );
                if (sync.managedUserExternalId) {
                  terminal.gray(` user=${sync.managedUserExternalId}`);
                }
                terminal("\n");
                if (sync.error) {
                  terminal.gray(`      reason: ${sync.error}\n`);
                }
              }
              if (pending.syncs.length > 10) {
                terminal.gray(
                  `    ... and ${pending.syncs.length - 10} more\n`
                );
              }
            }
          } else {
            terminal.gray("  None\n");
          }

          terminal("\n");

          // Stuck syncs (important!)
          terminal.bold("Stuck Syncs:\n");
          if (result.stuckSyncs && result.stuckSyncs.length > 0) {
            terminal.red(
              `  ${result.stuckSyncs.length} sync(s) appear stuck:\n`
            );
            for (const sync of result.stuckSyncs) {
              const mins = Math.floor(sync.stuckDurationSeconds / 60);
              const secs = sync.stuckDurationSeconds % 60;
              terminal.red(`    ${sync.id} ${sync.status} ${sync.type}`);
              terminal.red(` (no activity for ${mins}m ${secs}s)\n`);
              if (sync.integrationName) {
                terminal.gray(`      integration: ${sync.integrationName}\n`);
              }
            }
            terminal("\n");
            terminal.yellow(
              "  Tip: Stuck syncs may indicate the dev server disconnected.\n"
            );
            terminal.yellow(
              "  Use 'un syncs cancel <syncId>' to cancel stuck syncs.\n"
            );
          } else {
            terminal.green("  None\n");
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

// Trigger a sync
syncs
  .command("trigger")
  .description("Trigger a new sync for an integration")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(
    new Option(
      "-i, --integration <name>",
      "Integration name (required)"
    ).makeOptionMandatory()
  )
  .addOption(
    new Option(
      "-u, --user <id>",
      "Managed user external ID (or 'ALL' for all users)"
    ).makeOptionMandatory()
  )
  .addOption(
    new Option("-t, --type <type>", "Sync type").choices([
      "FULL",
      "INCREMENTAL",
    ])
  )
  .addOption(new Option("--wait", "Wait for sync to complete"))
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (options: {
      env?: string;
      environment?: string;
      integration: string;
      user: string;
      type?: "FULL" | "INCREMENTAL";
      wait?: boolean;
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

        // Build request body
        const body: Record<string, string> = {
          integrationName: options.integration,
        };

        if (options.user === "ALL") {
          body.managedUserId = "ALL";
        } else {
          body.managedUserExternalId = options.user;
        }

        if (options.type) {
          body.type = options.type;
        }

        terminal(
          `Triggering ${options.type ?? "auto"} sync for ${
            options.integration
          }...\n`
        );

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/syncs`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as {
            message?: string;
          };
          terminal.red(
            `Trigger sync failed: ${errorData.message ?? response.statusText}\n`
          );
          process.exitCode = 1;
          return;
        }

        const result = (await response.json()) as {
          message: string;
          syncId?: string;
          syncIds?: string[];
          syncCount?: number;
        };

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          terminal.green(`${result.message}\n`);
          if (result.syncId) {
            terminal(`Sync ID: ${result.syncId}\n`);
            terminal.gray(
              `\nTip: Run 'un syncs watch ${result.syncId} -e ${envName}' to monitor progress\n`
            );
          }
          if (result.syncIds && result.syncIds.length > 0) {
            terminal(`Sync IDs: ${result.syncIds.length} created\n`);
            for (const id of result.syncIds.slice(0, 5)) {
              terminal.gray(`  ${id}\n`);
            }
            if (result.syncIds.length > 5) {
              terminal.gray(`  ... and ${result.syncIds.length - 5} more\n`);
            }
          }
        }

        // Optionally wait for completion
        if (options.wait && result.syncId) {
          terminal("\nWaiting for sync to complete...\n");

          const pollInterval = 2000; // 2 seconds
          const maxWait = 30 * 60 * 1000; // 30 minutes
          const startTime = Date.now();

          while (Date.now() - startTime < maxWait) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));

            const syncResponse = await fetch(
              `${baseUrl}/api/v1/projects/default/envs/${envName}/syncs/${result.syncId}`,
              {
                headers: { Authorization: `Bearer ${apiKey}` },
              }
            );

            if (!syncResponse.ok) {
              terminal.yellow(`Warning: Could not fetch sync status\n`);
              continue;
            }

            const sync = (await syncResponse.json()) as {
              status: string;
              type: string;
              total: number;
              succeeded: number;
              failed: number;
              error?: string;
            };

            // Check if terminal state
            if (["SUCCEEDED", "FAILED", "CANCELED"].includes(sync.status)) {
              terminal("\n");
              if (sync.status === "SUCCEEDED") {
                terminal.green(`Sync completed successfully!\n`);
              } else if (sync.status === "FAILED") {
                terminal.red(`Sync failed: ${sync.error ?? "unknown error"}\n`);
              } else {
                terminal.yellow(`Sync was canceled\n`);
              }
              terminal(
                `Items: ${sync.total} total, ${sync.succeeded} succeeded, ${sync.failed} failed\n`
              );
              break;
            }

            // Show progress
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            terminal.eraseLine();
            terminal.column(0);
            terminal(
              `[${elapsed}s] ${sync.status} - ${sync.succeeded}/${sync.total} items`
            );
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

// Pause sync scheduling
syncs
  .command("scheduling:pause")
  .description(
    "Pause sync scheduling - no new syncs will be created, but existing syncs will complete"
  )
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .action(async (options: { env?: string; environment?: string }) => {
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
        `${baseUrl}/api/v1/projects/default/envs/${envName}/sync-scheduling/pause`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        terminal.red(
          `Failed to pause scheduling: ${
            errorData.message ?? response.statusText
          }\n`
        );
        process.exitCode = 1;
        return;
      }

      terminal.green(`Sync scheduling paused for ${envName}\n`);
      terminal.gray(
        `No new syncs will be created. Existing syncs will complete.\n`
      );
      terminal.gray(
        `Use 'un syncs scheduling:resume -e ${envName}' to resume.\n`
      );
    } catch (error) {
      terminal.red(
        `${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exitCode = 1;
    }
  });

// Resume sync scheduling
syncs
  .command("scheduling:resume")
  .description(
    "Resume sync scheduling - new syncs will be created according to schedules"
  )
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .action(async (options: { env?: string; environment?: string }) => {
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
        `${baseUrl}/api/v1/projects/default/envs/${envName}/sync-scheduling/resume`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        terminal.red(
          `Failed to resume scheduling: ${
            errorData.message ?? response.statusText
          }\n`
        );
        process.exitCode = 1;
        return;
      }

      terminal.green(`Sync scheduling resumed for ${envName}\n`);
      terminal.gray(
        `New syncs will be created according to configured schedules.\n`
      );
    } catch (error) {
      terminal.red(
        `${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exitCode = 1;
    }
  });

// Watch a sync with live-updating display
syncs
  .command("watch")
  .description("Watch a sync with live-updating progress display")
  .argument("<syncId>", "Sync ID")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(
    new Option(
      "--poll-interval <ms>",
      "Polling interval in milliseconds"
    ).default("1000")
  )
  .addOption(new Option("--no-clear", "Don't clear screen between updates"))
  .action(
    async (
      syncId: string,
      options: {
        env?: string;
        environment?: string;
        pollInterval: string;
        clear: boolean;
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

      const pollIntervalMs = Math.max(Number(options.pollInterval), 250);
      const startTime = Date.now();
      let lastTotal = 0;
      let lastTime = startTime;
      let rate = 0;
      let lastLineCount = 0;

      const terminalStatuses = new Set([
        "SUCCEEDED",
        "PARTIAL",
        "FAILED",
        "CANCELED",
        "SKIPPED",
      ]);

      const formatDuration = (ms: number): string => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
          return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
          return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
      };

      const renderProgress = (sync: any) => {
        const total = sync.total ?? 0;
        const succeeded = sync.succeeded ?? 0;
        const failed = sync.failed ?? 0;
        const processing = sync.processing ?? 0;
        const queued = sync.queued ?? 0;
        const canceled = sync.canceled ?? 0;
        const completed = succeeded + failed + canceled;

        // Calculate rate based on succeeded items (more accurate than total)
        const now = Date.now();
        const timeDelta = (now - lastTime) / 1000;
        if (timeDelta >= 1 && succeeded > lastTotal) {
          rate = (succeeded - lastTotal) / timeDelta;
          lastTotal = succeeded;
          lastTime = now;
        }

        // Current operation
        const currentModel =
          sync.currentModel?.name ?? sync.currentModelName ?? "-";
        const currentDirection = sync.currentDirection ?? "-";

        // Elapsed time
        const elapsed = formatDuration(now - startTime);

        // Build all lines first, then render
        const lines: Array<{
          text: string;
          color?: "green" | "red" | "yellow" | "cyan" | "magenta" | "gray";
        }> = [];

        lines.push({ text: `Sync ${syncId}` });
        lines.push({ text: "" });

        // Status line with color indicator
        const statusIndicator =
          sync.status === "SUCCEEDED"
            ? "✓"
            : sync.status === "FAILED"
            ? "✗"
            : sync.status === "CANCELED"
            ? "⊘"
            : sync.status === "RUNNING"
            ? "●"
            : sync.status === "FINISHING"
            ? "◐"
            : "○";
        lines.push({
          text: `${statusIndicator} ${sync.status}  |  ${
            sync.type ?? "?"
          }  |  ${currentModel} / ${currentDirection}`,
        });
        lines.push({ text: "" });

        // Progress bar - show during FINISHING or terminal states
        const showProgress =
          sync.status === "FINISHING" || terminalStatuses.has(sync.status);
        if (showProgress && total > 0) {
          const barWidth = 40;
          const progress = completed / total;
          const filledWidth = Math.round(progress * barWidth);
          const emptyWidth = barWidth - filledWidth;
          const progressBar = "█".repeat(filledWidth) + "░".repeat(emptyWidth);
          const percent = (progress * 100).toFixed(1);
          lines.push({ text: `[${progressBar}] ${percent}%` });
        } else {
          lines.push({ text: `[waiting for totals...]` });
        }
        lines.push({ text: "" });

        // Item counts - always show all on one line for consistency
        let itemsLine = `Items: ${succeeded.toLocaleString()} ok`;
        if (processing > 0)
          itemsLine += ` | ${processing.toLocaleString()} processing`;
        if (queued > 0) itemsLine += ` | ${queued.toLocaleString()} queued`;
        if (failed > 0) itemsLine += ` | ${failed.toLocaleString()} failed`;
        if (canceled > 0)
          itemsLine += ` | ${canceled.toLocaleString()} canceled`;
        itemsLine += ` | ${total.toLocaleString()} total`;
        lines.push({ text: itemsLine });

        // Elapsed and rate
        let elapsedLine = `Elapsed: ${elapsed}`;
        if (rate > 0) {
          elapsedLine += `  |  Rate: ~${rate.toFixed(0)} items/s`;
          if (total > succeeded && rate > 0) {
            const remaining = total - succeeded;
            const eta = Math.ceil(remaining / rate);
            elapsedLine += `  |  ETA: ${formatDuration(eta * 1000)}`;
          }
        }
        lines.push({ text: elapsedLine });

        // Error if present
        if (sync.error) {
          lines.push({ text: "" });
          lines.push({ text: `Error: ${sync.error}`, color: "red" });
        }

        // Model progress (compact)
        if (sync.modelStatuses && Object.keys(sync.modelStatuses).length > 0) {
          lines.push({ text: "" });
          const modelEntries = Object.entries(sync.modelStatuses) as Array<
            [string, any]
          >;
          const modelParts = modelEntries.map(([name, ms]) => {
            const hasProgress =
              (ms as any)?.cursor ||
              (ms as any)?.page ||
              (ms as any)?.lastExternalId;
            return hasProgress ? `✓${name}` : `·${name}`;
          });
          lines.push({ text: `Models: ${modelParts.join("  ")}` });
        }

        // Move cursor up to redraw in place
        if (options.clear && lastLineCount > 0) {
          terminal.up(lastLineCount);
        }

        // Render all lines
        let lineCount = 0;
        for (const line of lines) {
          terminal.column(1);
          if (line.color === "green") terminal.green(line.text);
          else if (line.color === "red") terminal.red(line.text);
          else if (line.color === "yellow") terminal.yellow(line.text);
          else if (line.color === "cyan") terminal.cyan(line.text);
          else if (line.color === "magenta") terminal.magenta(line.text);
          else if (line.color === "gray") terminal.gray(line.text);
          else terminal(line.text);
          terminal.eraseLineAfter();
          terminal("\n");
          lineCount++;
        }

        // Pad with empty lines if we rendered fewer lines than last time
        while (lineCount < lastLineCount) {
          terminal.column(1);
          terminal.eraseLineAfter();
          terminal("\n");
          lineCount++;
        }

        if (!options.clear) {
          terminal("\n---\n");
          lineCount += 2;
        }

        // Save line count for next iteration
        lastLineCount = lineCount;
      };

      terminal.bold("Starting watch...\n");
      terminal.gray("Press Ctrl+C to stop\n\n");

      // Handle Ctrl+C gracefully
      process.on("SIGINT", () => {
        terminal("\n\nWatch stopped.\n");
        process.exit(0);
      });

      while (true) {
        try {
          const result = await fetchSync(envName, syncId);

          renderProgress(result);

          if (terminalStatuses.has(result.status)) {
            terminal("\n");
            if (result.status === "SUCCEEDED") {
              terminal.green.bold("✓ Sync completed successfully!\n");
            } else if (result.status === "PARTIAL") {
              terminal.yellow.bold("⚠ Sync completed with some failures\n");
            } else if (result.status === "FAILED") {
              terminal.red.bold("✗ Sync failed\n");
              process.exitCode = 1;
            } else if (result.status === "CANCELED") {
              terminal.yellow.bold("⊘ Sync was canceled\n");
            } else if (result.status === "SKIPPED") {
              terminal.gray.bold("○ Sync was skipped\n");
            }
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        } catch (error) {
          terminal.red(
            `\nError fetching sync: ${
              error instanceof Error ? error.message : String(error)
            }\n`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, pollIntervalMs * 2)
          );
        }
      }
    }
  );
