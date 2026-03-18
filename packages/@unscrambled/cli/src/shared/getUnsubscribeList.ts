import { terminal } from "terminal-kit";
import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";

export default async function getUnsubscribeList(environment?: string) {
  const baseUrl = getBaseUrl();
  const envName = environment ?? getEnvName();
  const apiKey = getApiKey();

  const response = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/webhooks/unsubscribe-list`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (response.ok) {
    return await response.json();
  } else {
    console.error(
      "Failed to get unsubscribe list: ",
      response.status,
      response.statusText
    );
    console.error(await response.json(), "\n");
    return null;
  }
}
