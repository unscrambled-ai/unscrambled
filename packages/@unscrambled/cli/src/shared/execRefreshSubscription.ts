import readPackage from "./readPackage";
import getCompiledCode from "./getCompiledCode";
import runInContext from "./runInContext";
import { prepareConsole } from "../logging";
import { logDisplayLevel } from "./setLogDisplayLevel";
import updateRefreshSubscriptionResult from "./updateRefreshSubscriptionResult";

export interface ExecRefreshSubscriptionProps {
  webhookName: string;
  activityId: string;
}

export async function execRefreshSubscription(
  props: ExecRefreshSubscriptionProps
) {
  const { webhookName, activityId } = props;

  await updateRefreshSubscriptionResult({
    activityId,
    webhookName,
    startedAt: "now",
    status: "RUNNING",
  });

  const pkg = readPackage();
  const compiledCode = getCompiledCode(pkg.main);

  let handler;
  try {
    handler = runInContext(compiledCode).handler;
  } catch (error) {
    prepareConsole();
    console.error(
      `Error loading compiled code for refreshSubscription:`,
      error
    );
    throw error;
  }

  const result = await handler({
    operation: "refreshSubscription",
    webhookName,
    logDisplayLevel,
  });

  prepareConsole();

  const { statusCode, body } = result;
  const responseData = JSON.parse(body);
  const { unsubscribeProps, logs } = responseData;

  const status = statusCode >= 300 ? "FAILED" : "SUCCEEDED";

  console.debug("about to upload refresh subscription result");

  await updateRefreshSubscriptionResult({
    activityId,
    webhookName,
    endedAt: "now",
    status,
    logs,
    unsubscribeProps,
  });

  console.info(`Refreshed subscription successfully for ${webhookName}`);
}
