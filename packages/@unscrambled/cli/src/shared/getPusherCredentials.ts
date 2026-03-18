import { program } from "commander";
import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { parseJsonResponse } from "./parseJsonResponse";
import { terminal } from "terminal-kit";

export interface PusherCredentials {
  pusherKey: string;
  pusherCluster: string;
  userId: string;
  devEnvId: string;
  prodEnvId: string;
}

export default async function getPusherCredentials(): Promise<PusherCredentials> {
  const baseUrl = getBaseUrl();

  const apiKey = getApiKey();
  if (!apiKey) {
    terminal.red("\n❌ Authentication required\n\n");
    terminal("You need to log in or sign up before using this command.\n\n");
    terminal.bold("To get started, run one of the following commands:\n");
    terminal.green("  lightyear login\n");
    terminal.green("  lightyear signup\n\n");
    program.error("", { exitCode: 1 });
  }

  const response = await fetch(`${baseUrl}/api/v1/realtime/credentials`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    // parseJsonResponse will show detailed error information
    await parseJsonResponse(response, {
      operationName: "get pusher credentials",
      showResponsePreview: true,
    }).catch(() => {}); // Ignore parsing errors, we'll error out anyway

    program.error(
      `Could not get pusher credentials (HTTP ${response.status})`,
      {
        exitCode: 1,
      }
    );
  }

  return await parseJsonResponse(response, {
    operationName: "get pusher credentials",
    showResponsePreview: false,
  });
}
