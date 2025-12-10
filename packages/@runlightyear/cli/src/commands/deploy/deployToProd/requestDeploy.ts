import fse from "fs-extra";
import { program } from "commander";
import { TEMP_TGZ_FILE } from "./constants";
import { getApiKey } from "../../../shared/getApiKey";
import { getBaseUrl } from "../../../shared/getBaseUrl";

export default async function requestDeploy(envName: string) {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();

  const tgz = await fse.readFile(TEMP_TGZ_FILE);

  const response = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/deploy/request`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/gzip",
      },
      body: tgz,
    }
  );

  if (response.ok) {
    const data = await response.json();
    console.info(`Deploy requested: ${data.deployId}`);
    return data;
  } else {
    program.error("Error requesting deploy");
  }
}
