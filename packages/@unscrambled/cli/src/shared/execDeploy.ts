import readPackage from "./readPackage";
import getCompiledCode from "./getCompiledCode";
import runInContext from "./runInContext";
import updateDeploy from "./updateDeploy";
import { terminal } from "terminal-kit";
import { logDisplayLevel } from "./setLogDisplayLevel";
import { prepareConsole } from "../logging";
import { parseJsonResponse } from "./parseJsonResponse";
import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";

export interface ExecDeployProps {
  deployId: string;
  compiledCode: Buffer;
  environment?: string;
}

export default async function execDeploy(props: ExecDeployProps) {
  const { deployId, compiledCode, environment } = props;

  let handler;
  let getDeployList;

  try {
    const runInContextResult = runInContext(compiledCode);
    handler = runInContextResult.handler;
    getDeployList = runInContextResult.getDeployList;
  } catch (error) {
    prepareConsole();
    console.error(`Error loading compiled code for deploy:`, error);
    return;
  }

  if (getDeployList) {
    console.debug(
      "Before the deploy operation, getDeployList()",
      JSON.stringify(getDeployList(), null, 2)
    );
  } else {
    console.debug("getDeployList not returned");
  }

  const apiKey = getApiKey();
  const baseUrl = getBaseUrl();

  const handlerResult = await handler({
    operation: "deploy",
    deployId,
    logDisplayLevel,
    environment,
    payload: {
      apiKey,
      baseUrl,
      environment,
    },
  });

  prepareConsole();

  const { statusCode, body } = handlerResult;

  let responseData;
  let logs;

  try {
    responseData = JSON.parse(body);
    logs = responseData.logs;
  } catch (error) {
    terminal.red("\n❌ Failed to parse deploy handler response\n");
    terminal(`Response body preview:\n`);
    const preview =
      typeof body === "string"
        ? body.substring(0, 500)
        : String(body).substring(0, 500);
    terminal.dim(`${preview}${body.length > 500 ? "..." : ""}\n\n`);
    throw new Error(
      `Deploy handler returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const status = statusCode >= 300 ? "FAILED" : "SUCCEEDED";

  await updateDeploy({
    deployId,
    logs,
    environment,
  });

  return handlerResult;
}
