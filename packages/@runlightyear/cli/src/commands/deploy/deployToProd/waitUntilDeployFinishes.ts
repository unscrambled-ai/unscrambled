import fetchDeployLogs, { LogEntry } from "./fetchDeployLogs";
import fetchDeployStatus, { DeployStatus } from "./fetchDeployStatus";
import { terminal } from "terminal-kit";
import { logDisplayLevel } from "../../../shared/setLogDisplayLevel";
import { program } from "commander";

const POLL_INTERVAL_MS = 1000;

export default async function waitUntilDeployFinishes(
  deployId: string
): Promise<void> {
  let lastRedisEntryId: string | undefined;
  let isFinished = false;

  const displayLogs = (logs: LogEntry[]) => {
    if (logs.length === 0) return;

    const filteredLogs = logs.filter((log) =>
      logDisplayLevel === "DEBUG" ? true : log.level !== "DEBUG"
    );

    if (filteredLogs.length === 0) return;

    const logOutput =
      filteredLogs
        .map(
          (log) =>
            "\x1b[35m" +
            "Server: " +
            "\x1b[0m" +
            `[${log.level ?? "LOG"}]: ${log.message ?? ""}`
        )
        .join("\n") + "\n";
    terminal(logOutput);
  };

  const poll = async (): Promise<DeployStatus> => {
    // Fetch new logs since last poll
    try {
      const logsResponse = await fetchDeployLogs("prod", deployId, {
        fromRedisEntryId: lastRedisEntryId,
      });

      displayLogs(logsResponse.data.logs);

      // Update cursor for next poll
      if (logsResponse.data.pagination?.lastRedisEntryId) {
        lastRedisEntryId = logsResponse.data.pagination.lastRedisEntryId;
      }
    } catch (error) {
      // Log fetch errors but continue polling for status
      console.debug("Error fetching logs:", error);
    }

    // Check deploy status
    const statusResponse = await fetchDeployStatus("prod", deployId);
    return statusResponse.status;
  };

  // Initial poll
  console.info("Waiting for deploy to finish...");
  let status = await poll();
  console.info(`Initial deploy status: ${status}`);

  // Continue polling until deploy finishes
  while (!isFinished) {
    if (status === "SUCCEEDED") {
      terminal.green("Deploy succeeded! 🚀\n");
      isFinished = true;
    } else if (status === "FAILED") {
      terminal.red("Deploy failed 💥\n");
      program.error("Deploy failed", { exitCode: 1 });
    } else {
      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const newStatus = await poll();
      if (newStatus !== status) {
        console.info(`Deploy status changed: ${status} -> ${newStatus}`);
        status = newStatus;
      } else {
        status = newStatus;
      }
    }
  }
}
