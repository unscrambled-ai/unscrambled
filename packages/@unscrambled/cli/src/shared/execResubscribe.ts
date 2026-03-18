import readPackage from "./readPackage";
import getCompiledCode from "./getCompiledCode";
import execSubscribeProps from "./execSubscribeProps";
import createDeploy from "./createDeploy";
import execUnsubscribeAfterDeploy from "./execUnsubscribeAfterDeploy";
import execSubscribeAfterDeploy from "./execSubscribeAfterDeploy";
import updateDeploy from "./updateDeploy";

export interface ExecResubscribeProps {
  webhookName: string;
  manual: boolean;
}

export default async function execResubscribe(props: ExecResubscribeProps) {
  const { webhookName, manual } = props;

  const pkg = readPackage();
  const compiledCode = getCompiledCode(pkg.main);

  const deployId = await createDeploy({ status: "RUNNING", compiledCode });

  let message;
  if (manual) {
    message = `User requested resubscribe for ${webhookName}`;
  } else {
    message = `Resubscribe due to a change on ${webhookName}`;
  }

  console.info(message);
  await updateDeploy({
    deployId,
    logs: [`[INFO]: ${message}`],
  });

  await execSubscribeProps({ deployId, compiledCode });

  await execUnsubscribeAfterDeploy({ deployId });
  await execSubscribeAfterDeploy({ deployId, compiledCode });

  await updateDeploy({
    deployId,
    status: "SUCCEEDED",
    endedAt: "now",
  });
}
