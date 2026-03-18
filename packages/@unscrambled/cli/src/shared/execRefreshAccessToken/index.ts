import readPackage from "../readPackage";
import getCompiledCode from "../getCompiledCode";
import runInContext from "../runInContext";
import { logDisplayLevel } from "../setLogDisplayLevel";
import { prepareConsole } from "../../logging";
import { deliverLocalResponse } from "../deliverLocalResponse";
import {
  createAuthorizerActivity,
  updateAuthorizerActivity,
} from "../createAuthorizerActivity";
import { getApiKey } from "../getApiKey";
import { getBaseUrl } from "../getBaseUrl";
import { getEnvName } from "../getEnvName";

export interface ExecRefreshAccessTokenProps {
  customAppName: string;
  authName: string;
  code: string;
  localResponseId: string;
}

export async function execRefreshAccessToken(
  props: ExecRefreshAccessTokenProps
) {
  const { customAppName, authName, localResponseId } = props;

  const pkg = readPackage();
  const compiledCode = getCompiledCode(pkg.main);

  let authorizerActivityId: string | undefined;

  // Create the authorizer activity BEFORE execution so logs can be associated with it
  try {
    authorizerActivityId = await createAuthorizerActivity({
      customAppName,
      type: "REFRESH_ACCESS_TOKEN",
      status: "RUNNING",
    });
    console.debug(
      `Created authorizer activity with ID: ${authorizerActivityId}`
    );
  } catch (error) {
    prepareConsole();
    console.error("Failed to create authorizer activity:", error);
    // Continue without activity ID - logs won't be real-time but operation can still succeed
  }

  let handler;
  try {
    handler = runInContext(compiledCode).handler;
  } catch (error) {
    prepareConsole();
    console.error(`Error loading compiled code for refreshAccessToken:`, error);

    // Update activity as failed
    if (authorizerActivityId) {
      await updateAuthorizerActivity({
        customAppName,
        activityId: authorizerActivityId,
        status: "FAILED",
        logs: [
          `[ERROR] ${
            error instanceof Error
              ? error.message || String(error)
              : String(error)
          }`,
        ],
      });
    }

    throw error;
  }

  const result = await handler({
    operation: "refreshAccessToken",
    customAppName,
    authName,
    logDisplayLevel,
    payload: {
      customAppName,
      authName,
      apiKey: getApiKey(),
      baseUrl: getBaseUrl(),
      environment: getEnvName(),
      authorizerActivityId, // Pass the activity ID to the handler
    },
  });

  prepareConsole();

  const { statusCode, body } = result;
  const responseData = JSON.parse(body);
  const { logs } = responseData;

  const status = statusCode >= 300 ? "FAILED" : "SUCCEEDED";

  console.info(`Refreshed access token successfully for ${customAppName}`);

  // Update the authorizer activity with final status
  if (authorizerActivityId) {
    try {
      await updateAuthorizerActivity({
        customAppName,
        activityId: authorizerActivityId,
        status,
        logs: logs,
      });
    } catch (error) {
      console.error("Failed to update authorizer activity:", error);
    }
  } else {
    // Fallback: create activity with final status if we couldn't create it earlier
    try {
      await createAuthorizerActivity({
        customAppName,
        type: "REFRESH_ACCESS_TOKEN",
        status,
        logs: logs,
      });
    } catch (error) {
      console.error("Failed to create authorizer activity:", error);
    }
  }

  if (localResponseId) {
    await deliverLocalResponse({ localResponseId, response: "OK" });
  }

  return status;
}
