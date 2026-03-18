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

export const objects = new Command("objects").description(
  "Inspect and manage objects"
);

// Get a single object
objects
  .command("get")
  .description("Get a single object by ID")
  .argument("<objectId>", "Object ID (UUID)")
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
      objectId: string,
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
          `${baseUrl}/api/v1/projects/default/envs/${envName}/objects/${objectId}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            terminal.red(`Object '${objectId}' not found\n`);
            process.exitCode = 1;
            return;
          }
          checkResponseOk(response, "Get object");
          throw new Error(
            `Get object failed: HTTP ${response.status} ${response.statusText}`
          );
        }

        const obj = await parseJsonResponse(response, {
          operationName: "get object",
        });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
        } else {
          terminal.bold(`Object: ${obj.id}\n`);
          terminal(`Status: ${obj.status}\n`);
          terminal(`Created: ${obj.createdAt}\n`);
          terminal(`Updated: ${obj.updatedAt}\n`);

          if (obj.managedUser) {
            terminal(`\nManaged User:\n`);
            terminal(`  ID: ${obj.managedUser.id}\n`);
            terminal(`  External ID: ${obj.managedUser.externalId}\n`);
            terminal(`  Display Name: ${obj.managedUser.displayName}\n`);
          }

          if (obj.externalObjects && obj.externalObjects.length > 0) {
            terminal(`\nExternal Objects (${obj.externalObjects.length}):\n`);
            for (const eo of obj.externalObjects) {
              const integration =
                eo.app?.name || eo.customApp?.name || "(unknown)";
              terminal(`  - ${integration}: ${eo.externalId}\n`);
              terminal.gray(`    externalUpdatedAt: ${eo.externalUpdatedAt}\n`);
            }
          }

          if (obj.data) {
            terminal(`\nData:\n`);
            try {
              const parsed =
                typeof obj.data === "string" ? JSON.parse(obj.data) : obj.data;
              terminal(`${JSON.stringify(parsed, null, 2)}\n`);
            } catch {
              terminal(`${obj.data}\n`);
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

// List objects
objects
  .command("list")
  .description("List objects with optional filters")
  .addOption(
    new Option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  )
  .addOption(new Option("-c, --collection <name>", "Filter by collection name"))
  .addOption(new Option("--model <name>", "Filter by model name"))
  .addOption(
    new Option("-u, --managed-user-id <id>", "Filter by managed user ID (UUID)")
  )
  .addOption(
    new Option(
      "-m, --managed-user-external-id <id>",
      "Filter by managed user external ID"
    )
  )
  .addOption(new Option("--app <name>", "Filter by app name"))
  .addOption(new Option("--custom-app <name>", "Filter by custom app name"))
  .addOption(new Option("-q, --query <text>", "Search query"))
  .addOption(
    new Option("--status <status>", "Filter by status (UPSERTED, DELETED)")
  )
  .addOption(
    new Option(
      "-l, --limit <count>",
      "Max number of objects to return"
    ).default("20")
  )
  .addOption(new Option("--count-only", "Only return the count"))
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (options: {
      env?: string;
      environment?: string;
      collection?: string;
      model?: string;
      managedUserId?: string;
      managedUserExternalId?: string;
      app?: string;
      customApp?: string;
      query?: string;
      status?: string;
      limit: string;
      countOnly?: boolean;
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

        // Resolve managed user external ID to internal ID if needed
        let managedUserId = options.managedUserId;
        if (options.managedUserExternalId && !managedUserId) {
          const muResponse = await fetch(
            `${baseUrl}/api/v1/projects/default/envs/${envName}/managed-users/external-id/${encodeURIComponent(
              options.managedUserExternalId
            )}`,
            {
              headers: { Authorization: `Bearer ${apiKey}` },
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
        }

        // Build query params
        const params = new URLSearchParams();
        if (options.collection)
          params.set("collectionName", options.collection);
        if (options.model) params.set("modelName", options.model);
        if (managedUserId) params.set("managedUserId", managedUserId);
        if (options.app) params.set("appName", options.app);
        if (options.customApp) params.set("customAppName", options.customApp);
        if (options.query) params.set("query", options.query);
        if (options.status) params.set("objectStatus", options.status);
        if (options.countOnly) params.set("countOnly", "true");

        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/objects?${params}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          checkResponseOk(response, "List objects");
          throw new Error(
            `List objects failed: HTTP ${response.status} ${response.statusText}`
          );
        }

        const result = await parseJsonResponse(response, {
          operationName: "list objects",
        });

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          if (options.countOnly || result.count !== undefined) {
            terminal(`Count: ${result.count}\n`);
            if (result.empty !== undefined) {
              terminal(`Empty: ${result.empty}\n`);
            }
            return;
          }

          const objects = result.objects ?? [];
          if (objects.length === 0) {
            terminal("No objects found\n");
            return;
          }

          terminal.bold(`Objects:\n\n`);
          const limit = parseInt(options.limit, 10);
          for (const obj of objects.slice(0, limit)) {
            terminal.bold(`${obj.id}`);
            terminal(` [${obj.status}]\n`);
            terminal(`  updated: ${obj.updatedAt}\n`);
            if (obj.managedUser) {
              terminal.gray(`  managedUser: ${obj.managedUser.displayName}\n`);
            }
            if (obj.externalObjects && obj.externalObjects.length > 0) {
              for (const eo of obj.externalObjects) {
                const integration = eo.app?.name || eo.customApp?.name || "?";
                terminal.gray(`  ${integration}: ${eo.externalId}\n`);
              }
            }
            // Show abbreviated data
            if (obj.data) {
              try {
                const parsed =
                  typeof obj.data === "string"
                    ? JSON.parse(obj.data)
                    : obj.data;
                const keys = Object.keys(parsed).slice(0, 3);
                terminal.gray(
                  `  data: { ${keys.map((k) => `${k}: ...`).join(", ")} }\n`
                );
              } catch {
                terminal.gray(`  data: (present)\n`);
              }
            }
            terminal("\n");
          }

          terminal(
            `Showing ${Math.min(objects.length, limit)} of ${
              objects.length
            } objects\n`
          );
          if (result.cursor) {
            terminal.gray(`(more available, use cursor: ${result.cursor})\n`);
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

// Show external object mappings for an object
objects
  .command("external")
  .description(
    "Show external object mappings for an object (debug sync issues)"
  )
  .argument("<objectId>", "Object ID (UUID)")
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
      objectId: string,
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

        // Get the object to retrieve its external objects
        const response = await fetch(
          `${baseUrl}/api/v1/projects/default/envs/${envName}/objects/${objectId}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            terminal.red(`Object '${objectId}' not found\n`);
            process.exitCode = 1;
            return;
          }
          checkResponseOk(response, "Get object");
          throw new Error(
            `Get object failed: HTTP ${response.status} ${response.statusText}`
          );
        }

        const obj = await parseJsonResponse(response, {
          operationName: "get object",
        });

        if (options.output === "json") {
          process.stdout.write(
            `${JSON.stringify(
              {
                objectId: obj.id,
                status: obj.status,
                externalObjects: obj.externalObjects,
              },
              null,
              2
            )}\n`
          );
        } else {
          terminal.bold(`External mappings for object: ${obj.id}\n`);
          terminal(`Status: ${obj.status}\n\n`);

          if (!obj.externalObjects || obj.externalObjects.length === 0) {
            terminal.yellow("No external object mappings found.\n");
            terminal.gray(
              "This object has not been synced to any external system.\n"
            );
            return;
          }

          terminal.bold(
            "Integration".padEnd(25) +
              "External ID".padEnd(40) +
              "External Updated At\n"
          );
          terminal("-".repeat(85) + "\n");

          for (const eo of obj.externalObjects) {
            const integration =
              eo.app?.name || eo.customApp?.name || "(unknown)";
            terminal(
              integration.padEnd(25) +
                eo.externalId.padEnd(40) +
                eo.externalUpdatedAt +
                "\n"
            );
          }

          terminal(`\nTotal: ${obj.externalObjects.length} mapping(s)\n`);
        }
      } catch (error) {
        terminal.red(
          `${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exitCode = 1;
      }
    }
  );
