import readPackage from "./readPackage";
import getCompiledCode from "./getCompiledCode";
import runInContext from "./runInContext";
import { logDisplayLevel } from "./setLogDisplayLevel";
import { prepareConsole } from "../logging";
import { deliverLocalResponse } from "./deliverLocalResponse";
import {
  createAuthorizerActivity,
  updateAuthorizerActivity,
} from "./createAuthorizerActivity";
import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";

export interface ExecGetAuthRequestUrlProps {
  customAppName: string;
  authName: string;
  localResponseId: string;
}

export async function execGetAuthRequestUrl(props: ExecGetAuthRequestUrlProps) {
  const { customAppName, authName, localResponseId } = props;

  const pkg = readPackage();
  const compiledCode = getCompiledCode(pkg.main);

  let handler;
  let status: "SUCCEEDED" | "FAILED";
  let logs;
  let authorizerActivityId: string | undefined;

  // Create the authorizer activity BEFORE execution so logs can be associated with it
  try {
    authorizerActivityId = await createAuthorizerActivity({
      customAppName,
      type: "GET_AUTH_REQUEST_URL",
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

  try {
    handler = runInContext(compiledCode).handler;
  } catch (error) {
    prepareConsole();
    console.error(`Error loading compiled code for getAuthRequestUrl:`, error);
    status = "FAILED";
    logs = [
      `[ERROR] ${
        error instanceof Error ? error.message || String(error) : String(error)
      }`,
    ];
  }

  if (handler) {
    const handlerResult = await handler({
      operation: "getAuthRequestUrl",
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

    const { statusCode, body } = handlerResult;
    const responseData = JSON.parse(body);
    const { authRequestUrl, message, logs: logsFromVm } = responseData;

    status = statusCode >= 300 ? "FAILED" : "SUCCEEDED";

    let localResponse;

    if (status === "FAILED") {
      localResponse = {
        error: message,
      };
    } else {
      console.debug(`about to upload authRequestUrl: ${authRequestUrl}`);
      localResponse = {
        authRequestUrl,
      };
    }

    await deliverLocalResponse({
      localResponseId,
      response: JSON.stringify(localResponse),
    });

    console.info(`Returned auth request url for ${customAppName}`);

    logs = logsFromVm;
  } else {
    status = "FAILED";
  }

  // Update the authorizer activity with final status
  if (authorizerActivityId) {
    try {
      await updateAuthorizerActivity({
        customAppName,
        activityId: authorizerActivityId,
        status,
        logs,
      });
    } catch (error) {
      console.error("Failed to update authorizer activity:", error);
    }
  } else {
    // Fallback: create activity with final status if we couldn't create it earlier
    try {
      await createAuthorizerActivity({
        customAppName,
        type: "GET_AUTH_REQUEST_URL",
        status,
        logs,
      });
    } catch (error) {
      console.error("Failed to create authorizer activity:", error);
    }
  }
}
