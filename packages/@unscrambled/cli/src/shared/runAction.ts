import getCompiledCode from "./getCompiledCode";
import readPackage from "./readPackage";
import runInContext from "./runInContext";
import { prepareConsole } from "../logging";
import { logDisplayLevel } from "./setLogDisplayLevel";
import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";
import { terminal } from "terminal-kit";

export interface RunActionProps {
  actionName: string;
  runId: string;
  data?: object;
  deliveryId?: string;
  environment?: string;
}

export default async function runAction({
  actionName,
  runId,
  data,
  environment,
}: RunActionProps) {
  const baseUrl = getBaseUrl();
  const envName = environment ?? getEnvName();
  const apiKey = getApiKey();

  // Set environment variables so SDK code can access them in VM context
  process.env.UNSCRAMBLED_API_KEY = apiKey;
  process.env.BASE_URL = baseUrl;
  process.env.ENV_NAME = envName;

  const startResponse = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/runs/${runId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "RUNNING",
        startedAt: "now",
        // deliveryId,
      }),
    }
  );

  const pkg = readPackage();

  const compiledCode = getCompiledCode(pkg.main);

  let handler;
  let status;
  let logs;
  let isRerun = false;

  try {
    handler = runInContext(compiledCode).handler;
  } catch (error) {
    console.error(
      `Error loading compiled code for action ${actionName}:`,
      error
    );
    status = "FAILED";
    logs = [
      `[ERROR]: ${
        error instanceof Error ? error.message || String(error) : String(error)
      }`,
    ];
  }

  if (handler) {
    const handlerResult = await handler({
      operation: "run",
      actionName,
      runId,
      data,
      logDisplayLevel,
      payload: {
        runId,
        actionName,
        data,
        apiKey,
        baseUrl,
        environment: envName,
      },
    });

    prepareConsole();

    const { statusCode, body } = handlerResult;

    const responseData = JSON.parse(body);

    const { logs: logsFromVm } = responseData;

    isRerun =
      responseData?.data?.status === "RERUN" ||
      responseData?.data?.message === "Rerun" ||
      responseData?.message === "Rerun";

    const isCanceled =
      responseData?.data?.status === "CANCELED" ||
      responseData?.message === "Run canceled" ||
      responseData?.error === "Run canceled";

    if (statusCode === 202 && isRerun) {
      // Rerun is treated as a success; SDK handler already finished the run
      status = "SUCCEEDED";
    } else if (isCanceled) {
      status = "CANCELED";
    } else if (statusCode === 202) {
      status = "SKIPPED";
    } else if (statusCode >= 300) {
      status = "FAILED";
    } else {
      status = "SUCCEEDED";
    }

    logs = logsFromVm;

    if (isCanceled) {
      // Do not attempt to patch a canceled run; backend rejects updates for canceled runs
      terminal.yellow("Run was canceled by the platform.\n");
      return;
    }
  }

  // If handler indicated a rerun, the SDK finished the run with rerun=true.
  // Avoid overriding that state with a PATCH here.
  if (!isRerun) {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/default/envs/${envName}/runs/${runId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          // logs,
          endedAt: "now",
          // deliveryId,
        }),
      }
    );

    if (response.ok) {
      console.info("Uploaded run result");
    } else {
      console.error(
        "Failed to upload run result",
        response.status,
        response.statusText
      );
      const text = await response.text();
      console.error(text);
    }
  } else {
    console.info(
      "Rerun requested; skipping CLI status patch to preserve rerun state"
    );
  }
}
