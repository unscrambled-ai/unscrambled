import requestDeploy from "./requestDeploy";
import tarSourceCode from "./tarSourceCode";
import getFileList from "./getFileList";
import deleteTgz from "./deleteTgz";
import waitUntilDeployFinishes from "./waitUntilDeployFinishes";
import type { DeployStatus } from "./fetchDeployStatus";
import createDeploy from "../../../shared/createDeploy";
import readPackage from "../../../shared/readPackage";
import getCompiledCode from "../../../shared/getCompiledCode";
import { execBuild } from "../../../shared/execBuild";

export interface DeployToProdResult {
  envName: "prod";
  deployId: string;
  status: DeployStatus;
}

export interface DeployToProdOptions {
  quiet?: boolean;
  emitLogs?: boolean;
}

export default async function deployToProd(
  options: DeployToProdOptions = {}
): Promise<DeployToProdResult> {
  if (!options.quiet) {
    console.info("Deploying to prod");
  }

  // const fileList = await getFileList();
  // await tarSourceCode(fileList);
  // const { deployId } = await requestDeploy("prod");
  // await deleteTgz();

  await execBuild({ quiet: options.quiet });

  const pkg = readPackage();
  const compiledCode = getCompiledCode(pkg.main);

  const deployId = await createDeploy({
    envName: "prod",
    status: "QUEUED",
    compiledCode,
    quiet: options.quiet,
  });

  if (!options.quiet) {
    console.debug("deployId", deployId);
  }

  const status = await waitUntilDeployFinishes(deployId, {
    quiet: options.quiet,
    emitLogs: options.emitLogs,
  });

  return {
    envName: "prod",
    deployId,
    status,
  };
}
