import { Command, Option } from "commander";
import { terminal } from "terminal-kit";

import { requireAuth } from "../../shared/requireAuth";
import { getApiKey } from "../../shared/getApiKey";
import { getBaseUrl } from "../../shared/getBaseUrl";
import { checkResponseOk, parseJsonResponse } from "../../shared/parseJsonResponse";

type OutputFormat = "text" | "json";

export const envs = new Command("envs").description(
  "Manage and inspect environments"
);

// List environments
envs
  .command("list")
  .description("List all environments")
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(async (options: { output: OutputFormat }) => {
    requireAuth();

    try {
      const baseUrl = getBaseUrl();
      const apiKey = getApiKey();

      const response = await fetch(
        `${baseUrl}/api/v1/projects/default/envs`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );

      if (!response.ok) {
        checkResponseOk(response, "List environments");
        throw new Error(`List environments failed: HTTP ${response.status} ${response.statusText}`);
      }

      const envs = await parseJsonResponse(response, { operationName: "list environments" });

      if (options.output === "json") {
        process.stdout.write(`${JSON.stringify(envs, null, 2)}\n`);
      } else {
        if (!Array.isArray(envs) || envs.length === 0) {
          terminal("No environments found\n");
          return;
        }

        terminal.bold(`Environments:\n\n`);
        for (const e of envs) {
          terminal.bold(`${e.name}`);
          terminal(` (${e.title})\n`);
        }

        terminal(`\nTotal: ${envs.length} environment(s)\n`);
      }
    } catch (error) {
      terminal.red(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  });

// Get environment status
envs
  .command("status")
  .description("Get status overview for an environment")
  .argument("<name>", "Environment name")
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .action(
    async (name: string, options: { output: OutputFormat }) => {
      requireAuth();

      try {
        const baseUrl = getBaseUrl();
        const apiKey = getApiKey();

        // Gather stats from multiple endpoints in parallel
        const [collectionsRes, managedUsersRes, syncsRes, runsRes] = await Promise.all([
          fetch(`${baseUrl}/api/v1/projects/default/envs/${name}/collections`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          }),
          fetch(`${baseUrl}/api/v1/projects/default/envs/${name}/managed-users?countOnly=true`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          }),
          fetch(`${baseUrl}/api/v1/projects/default/envs/${name}/syncs?syncStatus=RUNNING`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          }),
          fetch(`${baseUrl}/api/v1/projects/default/envs/${name}/runs?runStatus=RUNNING`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          }),
        ]);

        const collections = collectionsRes.ok ? await collectionsRes.json() : [];
        const managedUsersData = managedUsersRes.ok ? await managedUsersRes.json() : { count: 0 };
        const syncsData = syncsRes.ok ? await syncsRes.json() : { syncs: [] };
        const runsData = runsRes.ok ? await runsRes.json() : { runs: [] };

        const status = {
          envName: name,
          collections: Array.isArray(collections) ? collections.length : 0,
          managedUsers: managedUsersData.count ?? 0,
          runningSyncs: syncsData.syncs?.length ?? 0,
          runningRuns: runsData.runs?.length ?? 0,
        };

        if (options.output === "json") {
          process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
        } else {
          terminal.bold(`Environment Name: ${name}\n\n`);
          terminal(`Collections: ${status.collections}\n`);
          terminal(`Managed Users: ${status.managedUsers}\n`);
          terminal(`Running Syncs: ${status.runningSyncs}\n`);
          terminal(`Running Runs: ${status.runningRuns}\n`);

          if (status.runningSyncs > 0) {
            terminal(`\nActive Syncs:\n`);
            for (const sync of syncsData.syncs.slice(0, 5)) {
              terminal(`  - ${sync.id.substring(0, 8)}... ${sync.collection?.name || "?"} [${sync.status}]\n`);
            }
            if (syncsData.syncs.length > 5) {
              terminal.gray(`  ... and ${syncsData.syncs.length - 5} more\n`);
            }
          }
        }
      } catch (error) {
        terminal.red(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  );
