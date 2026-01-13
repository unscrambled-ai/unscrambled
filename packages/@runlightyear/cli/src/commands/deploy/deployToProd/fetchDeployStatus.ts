import { program } from "commander";
import { getApiKey } from "../../../shared/getApiKey";
import { getBaseUrl } from "../../../shared/getBaseUrl";

export type DeployStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";

export type DeployStatusResponse = {
  id: string;
  status: DeployStatus;
  reason: string | null;
  createdAt: string;
};

export default async function fetchDeployStatus(
  envName: string,
  deployId: string
): Promise<DeployStatusResponse> {
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
    program.error(`Error fetching deploy status: ${response.status} ${response.statusText}`);
  }
}

