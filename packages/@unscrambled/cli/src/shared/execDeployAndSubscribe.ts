import readPackage from "./readPackage";
import getCompiledCode from "./getCompiledCode";
import createDeploy from "./createDeploy";
import execDeploy from "./execDeploy";
import execSubscribeProps from "./execSubscribeProps";
import execUnsubscribeAfterDeploy from "./execUnsubscribeAfterDeploy";
import execSubscribeAfterDeploy from "./execSubscribeAfterDeploy";
import { terminal } from "terminal-kit";
import updateDeploy from "./updateDeploy";
import getPreviouslyDeployedCode from "./getPreviouslyDeployedCode";
import runInContext from "./runInContext";

export default async function execDeployAndSubscribe(environment?: string) {
  const pkg = readPackage();
  const compiledCode = getCompiledCode(pkg.main);
  // const previousCompiledCode = await getPreviouslyDeployedCode();

  try {
    runInContext(compiledCode);
  } catch (error) {
    console.error(`Error loading compiled code for deployAndSubscribe:`, error);
    return;
  }

  const deployId = await createDeploy({
    status: "RUNNING",
    compiledCode,
    envName: environment as "dev" | "prod" | undefined,
  });

  const handlerResult = await execDeploy({
    deployId,
    compiledCode,
    environment,
  });

  const { statusCode } = handlerResult;
  const status = statusCode >= 300 ? "FAILED" : "SUCCEEDED";

  if (status === "SUCCEEDED") {
    await execSubscribeProps({ deployId, compiledCode, environment });
    await execUnsubscribeAfterDeploy({
      deployId,
      environment,
    });
    await execSubscribeAfterDeploy({ deployId, compiledCode, environment });
  }

  if (status === "SUCCEEDED") {
    // terminal.green("🚀 Deploy succeeded!\n");
  } else if (status === "FAILED") {
    terminal.red("💥 Deploy failed\n");
  }

  await updateDeploy({
    deployId,
    status,
    endedAt: "now",
    environment,
  });
}
