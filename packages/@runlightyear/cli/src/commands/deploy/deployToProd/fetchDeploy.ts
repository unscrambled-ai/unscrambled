import { program } from "commander";
import { getApiKey } from "../../../shared/getApiKey";
import { getBaseUrl } from "../../../shared/getBaseUrl";

export default async function fetchDeploy(envName: string, deployId: string) {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();

  const response = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/deploys/${deployId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (response.ok) {
    return await response.json();
  } else {
    program.error("Error fetching deploy");
  }
}
