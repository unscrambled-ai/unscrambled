import readPackage from "./readPackage";
import getCompiledCode from "./getCompiledCode";
import runInContext from "./runInContext";
import { logDisplayLevel } from "./setLogDisplayLevel";
import updateDeploy from "./updateDeploy";
import { prepareConsole } from "../logging";

export interface ExecSubscribeProps {
  deployId: string;
  compiledCode: Buffer;
  environment?: string;
}

export default async function execSubscribeProps(props: ExecSubscribeProps) {
  const { deployId, compiledCode, environment } = props;

  const handler = runInContext(compiledCode).handler;

  console.debug("Evaluating subscribe props");
  const handlerResult = await handler({
    operation: "subscribeProps",
    logDisplayLevel,
    environment,
  });

  prepareConsole();

  const { body } = handlerResult;
  const responseData = JSON.parse(body);
  const { logs } = responseData;

  await updateDeploy({
    deployId,
    logs,
    environment,
  });

  return handlerResult;
}
