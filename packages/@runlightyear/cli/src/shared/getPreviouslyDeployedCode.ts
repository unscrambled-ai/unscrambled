import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";

export interface GetPreviouslyDeployedCodeProps {
  webhookName: string;
  environment?: string;
}

export default async function getPreviouslyDeployedCode(
  props: GetPreviouslyDeployedCodeProps
): Promise<Buffer | null> {
  const baseUrl = getBaseUrl();
  const envName = props.environment ?? getEnvName();
  const apiKey = getApiKey();

  const { webhookName } = props;

  console.debug("Fetching subscription deploy code for", webhookName);

  const response = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/webhooks/${webhookName}/subscription/deploy/code`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  console.debug("Back from fetching subscription deploy code for", webhookName);

  if (response.ok) {
    const data = await response.json();
    if (!data.compiledCode) {
      throw new Error("Missing compiledCode");
    }

    console.debug("Got subscription deploy code");
    return Buffer.from(data.compiledCode, "base64");
  } else {
    console.debug("Previous deploy not found");
    return null;
  }
}
