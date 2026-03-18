import { logDisplayLevel } from "./setLogDisplayLevel";
import { prepareConsole } from "../logging";
import runInContext from "./runInContext";
import updateUnsubscribeResult from "./updateUnsubscribeResult";
import getPreviouslyDeployedCode from "./getPreviouslyDeployedCode";
import createUnsubscribeActivity from "./createUnsubscribeActivity";

export interface ExecUnsubscribeProps {
  webhookName: string;
  removed: boolean;
  environment?: string;
}

export default async function execUnsubscribe(props: ExecUnsubscribeProps) {
  const { webhookName, removed, environment } = props;

  console.debug("Unsubscribing", webhookName);

  const activityId = await createUnsubscribeActivity({
    webhookName,
    removed,
    environment,
  });

  await updateUnsubscribeResult({
    webhookName,
    startedAt: "now",
    status: "RUNNING",
    removed,
    subscriptionActivityId: activityId,
    environment,
  });

  const compiledCode = await getPreviouslyDeployedCode({
    webhookName,
    environment,
  });

  console.debug("Back from getPreviouslyDeployedCode");

  if (!compiledCode) {
    console.debug(
      "No previously deployed code found, skipping unsubscribe for",
      webhookName
    );
    throw new Error("No previously deployed code found");
  }

  console.debug("About to run unsubscribe in VM");

  const handler = runInContext(compiledCode).handler;

  const handlerResult = await handler({
    operation: "unsubscribe",
    webhookName,
    // removed: true,
    logDisplayLevel,
    environment,
  });

  prepareConsole();

  const { statusCode, body } = handlerResult;
  const responseData = JSON.parse(body);
  const { logs } = responseData;

  const status = statusCode >= 300 ? "FAILED" : "SUCCEEDED";

  console.debug("about to upload unsubscribe result");

  await updateUnsubscribeResult({
    webhookName,
    endedAt: "now",
    status,
    logs,
    removed,
    subscriptionActivityId: activityId,
    environment,
  });
}
