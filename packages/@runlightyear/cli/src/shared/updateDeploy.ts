import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";
import { parseJsonResponse } from "./parseJsonResponse";

export interface UpdateDeployProps {
  deployId: string;
  status?: string;
  endedAt?: "now";
  logs?: any;
  compiledCode?: any;
  environment?: string;
}

export default async function updateDeploy(props: UpdateDeployProps) {
  const { deployId, status, endedAt, logs, compiledCode, environment } = props;

  const baseUrl = getBaseUrl();
  const envName = environment ?? getEnvName();
  const apiKey = getApiKey();

  let response;

  try {
    response = await fetch(
      `${baseUrl}/api/v1/projects/default/envs/${envName}/deploys/${deployId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          endedAt,
          logs,
          compiledCode:
            compiledCode && Buffer.from(compiledCode).toString("base64"),
        }),
      }
    );
  } catch (error) {
    console.error("Exception thrown ", error);
    return;
  }

  if (!response.ok) {
    console.error(
      "Failed to upload deploy result",
      response.status,
      response.statusText
    );

    // Try to get error details from response
    try {
      const errorData = await parseJsonResponse(response, {
        operationName: "update deploy",
        showResponsePreview: true,
      });
      console.error(errorData);
    } catch (parseError) {
      // parseJsonResponse already logged detailed error info
    }
  }
}
