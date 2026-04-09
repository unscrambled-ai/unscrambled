import { Command, Option, program } from "commander";
import { terminal } from "terminal-kit";

import {
  confirmDangerousAction,
  writeError,
  writeInfo,
  writeSuccess,
} from "../../shared/commandUtils";
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

export const collections = new Command("collections").description(
  "Inspect collections and models"
);

// List all collections
collections
  .command("list")
  .description("List all collections and their models")
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
          `${baseUrl}/api/v1/projects/default/envs/${envName}/collections`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          checkResponseOk(response, "List collections");
          throw new Error(
            `List collections failed: HTTP ${response.status} ${response.statusText}`
          );
        }

        const collections = await parseJsonResponse(response, {
          operationName: "list collections",
        });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(collections, null, 2)}\n`);
        } else {
          if (!Array.isArray(collections) || collections.length === 0) {
            terminal("No collections found\n");
            return;
          }

          terminal.bold(`Collections in ${envName}:\n\n`);
          for (const coll of collections) {
            terminal.bold(`${coll.name}`);
            terminal(` (${coll.title})\n`);
            if (coll.models && coll.models.length > 0) {
              for (const model of coll.models) {
                terminal(`  - ${model.name} (${model.title})\n`);
              }
            } else {
              terminal.gray("  (no models)\n");
            }
            terminal("\n");
          }
          terminal(`Total: ${collections.length} collection(s)\n`);
        }
      } catch (error) {
        terminal.red(
          `${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exitCode = 1;
      }
    }
  );

// Get a single collection
collections
  .command("get")
  .description("Get details for a specific collection")
  .argument("<collectionName>", "Collection name")
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
      collectionName: string,
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
          `${baseUrl}/api/v1/projects/default/envs/${envName}/collections/${collectionName}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            terminal.red(`Collection '${collectionName}' not found\n`);
            process.exitCode = 1;
            return;
          }
          checkResponseOk(response, "Get collection");
          throw new Error(
            `Get collection failed: HTTP ${response.status} ${response.statusText}`
          );
        }

        const coll = await parseJsonResponse(response, {
          operationName: "get collection",
        });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(coll, null, 2)}\n`);
        } else {
          terminal.bold(`Collection: ${coll.name}\n`);
          terminal(`Title: ${coll.title}\n`);
          terminal(`ID: ${coll.id}\n`);
          terminal(`Schema Version: ${coll.schemaVersion ?? "(none)"}\n`);
          terminal("\n");

          if (coll.models && coll.models.length > 0) {
            terminal.bold("Models:\n");
            for (const model of coll.models) {
              terminal(`  - ${model.name} (${model.title})\n`);
              terminal.gray(`    id: ${model.id}\n`);
            }
          } else {
            terminal.gray("No models defined\n");
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

// Get object counts per model
collections
  .command("stats")
  .description("Get object counts per model for a collection")
  .argument("<collectionName>", "Collection name")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(
    new Option("-u, --managed-user-id <id>", "Filter by managed user ID (UUID)")
  )
  .addOption(
    new Option(
      "-m, --managed-user-external-id <id>",
      "Filter by managed user external ID"
    )
  )
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (
      collectionName: string,
      options: {
        env?: string;
        environment?: string;
        managedUserId?: string;
        managedUserExternalId?: string;
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

        // Resolve managed user ID if external ID is provided
        let managedUserId = options.managedUserId;
        let managedUserDisplay: string | undefined;

        if (options.managedUserExternalId && !managedUserId) {
          const muResponse = await fetch(
            `${baseUrl}/api/v1/projects/default/envs/${envName}/managed-users/external-id/${encodeURIComponent(
              options.managedUserExternalId
            )}`,
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
            }
          );

          if (!muResponse.ok) {
            if (muResponse.status === 404) {
              terminal.red(
                `Managed user with external ID '${options.managedUserExternalId}' not found\n`
              );
              process.exitCode = 1;
              return;
            }
            throw new Error(
              `Failed to look up managed user: HTTP ${muResponse.status}`
            );
          }

          const muData = await muResponse.json();
          managedUserId = muData.id;
          managedUserDisplay =
            muData.displayName || options.managedUserExternalId;
        } else if (managedUserId) {
          managedUserDisplay = managedUserId;
        }

        // First get the collection to list its models
        const collResponse = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/collections/${collectionName}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!collResponse.ok) {
          if (collResponse.status === 404) {
            terminal.red(`Collection '${collectionName}' not found\n`);
            process.exitCode = 1;
            return;
          }
          checkResponseOk(collResponse, "Get collection");
          throw new Error(
            `Get collection failed: HTTP ${collResponse.status} ${collResponse.statusText}`
          );
        }

        const coll = await parseJsonResponse(collResponse, {
          operationName: "get collection",
        });

        if (!coll.models || coll.models.length === 0) {
          terminal("No models in collection\n");
          return;
        }

        // Get counts for each model
        const stats: Array<{
          modelName: string;
          modelTitle: string;
          upserted: number;
          deleted: number;
          total: number;
        }> = [];

        for (const model of coll.models) {
          // Build query params
          const baseParams = `collectionName=${collectionName}&modelName=${model.name}&countOnly=true`;
          const managedUserParam = managedUserId
            ? `&managedUserId=${managedUserId}`
            : "";

          // Get UPSERTED count
          const upsertedResponse = await fetch(
            `${baseUrl}/api/v1/projects/default/envs/${envName}/objects?${baseParams}&objectStatus=UPSERTED${managedUserParam}`,
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
            }
          );

          let upsertedCount = 0;
          if (upsertedResponse.ok) {
            const upsertedData = await upsertedResponse.json();
            upsertedCount = upsertedData.count ?? 0;
          }

          // Get DELETED count
          const deletedResponse = await fetch(
            `${baseUrl}/api/v1/projects/default/envs/${envName}/objects?${baseParams}&objectStatus=DELETED${managedUserParam}`,
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
            }
          );

          let deletedCount = 0;
          if (deletedResponse.ok) {
            const deletedData = await deletedResponse.json();
            deletedCount = deletedData.count ?? 0;
          }

          stats.push({
            modelName: model.name,
            modelTitle: model.title,
            upserted: upsertedCount,
            deleted: deletedCount,
            total: upsertedCount + deletedCount,
          });
        }

        if (options.output === "json") {
          process.stdout.write(
            `${JSON.stringify(
              {
                collection: collectionName,
                schemaVersion: coll.schemaVersion,
                managedUserId: managedUserId ?? null,
                managedUserExternalId: options.managedUserExternalId ?? null,
                models: stats,
                totals: {
                  upserted: stats.reduce((sum, s) => sum + s.upserted, 0),
                  deleted: stats.reduce((sum, s) => sum + s.deleted, 0),
                  total: stats.reduce((sum, s) => sum + s.total, 0),
                },
              },
              null,
              2
            )}\n`
          );
        } else {
          terminal.bold(`Stats for collection: ${collectionName}\n`);
          terminal(`Schema Version: ${coll.schemaVersion ?? "(none)"}\n`);
          if (managedUserDisplay) {
            terminal(`Managed User: ${managedUserDisplay}\n`);
          }
          terminal("\n");

          terminal.bold(
            "Model".padEnd(30) +
              "Upserted".padStart(12) +
              "Deleted".padStart(12) +
              "Total".padStart(12) +
              "\n"
          );
          terminal("-".repeat(66) + "\n");

          for (const s of stats) {
            terminal(
              s.modelName.padEnd(30) +
                String(s.upserted).padStart(12) +
                String(s.deleted).padStart(12) +
                String(s.total).padStart(12) +
                "\n"
            );
          }

          terminal("-".repeat(66) + "\n");
          const totals = {
            upserted: stats.reduce((sum, s) => sum + s.upserted, 0),
            deleted: stats.reduce((sum, s) => sum + s.deleted, 0),
            total: stats.reduce((sum, s) => sum + s.total, 0),
          };
          terminal.bold(
            "TOTAL".padEnd(30) +
              String(totals.upserted).padStart(12) +
              String(totals.deleted).padStart(12) +
              String(totals.total).padStart(12) +
              "\n"
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

// Reset sync state for a collection
collections
  .command("reset")
  .description(
    "Reset sync state for a collection (clears cursors, forces full re-sync)"
  )
  .argument("<collectionName>", "Collection name")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(new Option("--yes", "Skip confirmation prompt"))
  .addOption(
    new Option("--dry-run", "Preview the reset without making changes")
  )
  .addOption(new Option("-f, --force", "Deprecated alias for --yes").hideHelp())
  .action(
    async (
      collectionName: string,
      options: {
        env?: string;
        environment?: string;
        yes?: boolean;
        force?: boolean;
        dryRun?: boolean;
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

        // First verify the collection exists
        const collResponse = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/collections/${collectionName}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );

        if (!collResponse.ok) {
          if (collResponse.status === 404) {
            terminal.red(`Collection '${collectionName}' not found\n`);
            process.exitCode = 1;
            return;
          }
          throw new Error(`Get collection failed: HTTP ${collResponse.status}`);
        }

        const coll = await collResponse.json();

        terminal(`Collection: ${coll.name} (${coll.title})\n`);
        terminal(`Schema Version: ${coll.schemaVersion ?? "(none)"}\n`);
        terminal(`Models: ${coll.models?.length ?? 0}\n\n`);

        terminal.yellow(
          "This will reset all sync cursors and force a full re-sync.\n"
        );
        terminal.yellow("Existing objects will NOT be deleted.\n\n");

        if (options.dryRun) {
          writeInfo(
            `Dry run: would reset collection '${collectionName}' in ${envName} and force a full re-sync.`
          );
          return;
        }

        await confirmDangerousAction({
          yes: options.yes ?? options.force,
          dryRun: options.dryRun,
          prompt: "Are you sure you want to reset this collection? [y/N]",
        });

        writeInfo("Resetting collection...");

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/collections/${collectionName}/reset`,
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
            `Reset failed: ${errorData.message || response.statusText}\n`
          );
          process.exitCode = 1;
          return;
        }

        writeSuccess("Collection reset successfully.");
        terminal("Next sync will perform a full re-sync.\n");
      } catch (error) {
        writeError(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    }
  );

// Clear all objects from a collection
collections
  .command("clear")
  .description("Clear all objects from a collection (DESTRUCTIVE)")
  .argument("<collectionName>", "Collection name")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(new Option("--yes", "Skip confirmation prompt"))
  .addOption(
    new Option("--dry-run", "Preview the clear without making changes")
  )
  .addOption(new Option("-f, --force", "Deprecated alias for --yes").hideHelp())
  .action(
    async (
      collectionName: string,
      options: {
        env?: string;
        environment?: string;
        yes?: boolean;
        force?: boolean;
        dryRun?: boolean;
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

        // First verify the collection exists and get stats
        const collResponse = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/collections/${collectionName}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );

        if (!collResponse.ok) {
          if (collResponse.status === 404) {
            terminal.red(`Collection '${collectionName}' not found\n`);
            process.exitCode = 1;
            return;
          }
          throw new Error(`Get collection failed: HTTP ${collResponse.status}`);
        }

        const coll = await collResponse.json();

        terminal(`Collection: ${coll.name} (${coll.title})\n`);
        terminal(`Models: ${coll.models?.length ?? 0}\n\n`);

        terminal.red.bold(
          "WARNING: This will DELETE ALL OBJECTS in this collection!\n"
        );
        terminal.red("This action cannot be undone.\n\n");

        if (options.dryRun) {
          writeInfo(
            `Dry run: would clear all objects from collection '${collectionName}' in ${envName}.`
          );
          return;
        }

        await confirmDangerousAction({
          yes: options.yes ?? options.force,
          dryRun: options.dryRun,
          prompt: `Type the collection name to confirm deletion:`,
          expectedText: collectionName,
        });

        writeInfo("Clearing collection...");

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/collections/${collectionName}/clear`,
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
            `Clear failed: ${errorData.message || response.statusText}\n`
          );
          process.exitCode = 1;
          return;
        }

        const result = await response.json();
        writeSuccess("Collection cleared successfully.");
        if (result.deletedCount !== undefined) {
          terminal(`Deleted ${result.deletedCount} objects.\n`);
        }
      } catch (error) {
        writeError(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    }
  );
