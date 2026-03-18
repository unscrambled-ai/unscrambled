import { program } from "commander";
import { getApiKey } from "../../../shared/getApiKey";
import { getBaseUrl } from "../../../shared/getBaseUrl";

export type LogEntry = {
  id: string;
  timestamp: string;
  level?: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";
  message?: string;
};

export type FetchDeployLogsResponse = {
  data: {
    logs: LogEntry[];
    pagination?: {
      totalCount?: number;
      hasMore?: boolean;
      lastRedisEntryId?: string;
    };
  };
};

export interface FetchDeployLogsOptions {
  fromRedisEntryId?: string;
  fromTimestamp?: string;
  size?: number;
  level?: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";
}

export default async function fetchDeployLogs(
  envName: string,
  deployId: string,
  options: FetchDeployLogsOptions = {}
): Promise<FetchDeployLogsResponse> {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();

  const url = new URL(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/logs/deploy/${deployId}`
  );

  // Add query parameters
  if (options.fromRedisEntryId) {
    url.searchParams.set("fromRedisEntryId", options.fromRedisEntryId);
  }
  if (options.fromTimestamp) {
    url.searchParams.set("fromTimestamp", options.fromTimestamp);
  }
  if (options.size) {
    url.searchParams.set("size", String(options.size));
  }
  if (options.level) {
    url.searchParams.set("level", options.level);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (response.ok) {
    return await response.json();
  } else {
    program.error(
      `Error fetching deploy logs: ${response.status} ${response.statusText}`
    );
  }
}
