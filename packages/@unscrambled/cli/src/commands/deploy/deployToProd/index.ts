import requestDeploy from "./requestDeploy";
import tarSourceCode from "./tarSourceCode";
import getFileList from "./getFileList";
import deleteTgz from "./deleteTgz";
import waitUntilDeployFinishes from "./waitUntilDeployFinishes";
import createDeploy from "../../../shared/createDeploy";
import readPackage from "../../../shared/readPackage";
import getCompiledCode from "../../../shared/getCompiledCode";
import { execBuild } from "../../../shared/execBuild";

export default async function deployToProd() {
  console.info("Deploying to prod");

  // const fileList = await getFileList();
  // await tarSourceCode(fileList);
  // const { deployId } = await requestDeploy("prod");
  // await deleteTgz();

  await execBuild();

  const pkg = readPackage();
  const compiledCode = getCompiledCode(pkg.main);

  const deployId = await createDeploy({
    envName: "prod",
    status: "QUEUED",
    compiledCode,
  });

  console.debug("deployId", deployId);

  await waitUntilDeployFinishes(deployId);
}
