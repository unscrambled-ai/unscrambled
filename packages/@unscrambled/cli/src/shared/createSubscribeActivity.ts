import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";

export interface CreateSubscribeActivityProps {
  webhookName: string;
  deployId: string;
  environment?: string;
}

export default async function createSubscribeActivity(
  props: CreateSubscribeActivityProps
) {
  const { webhookName, deployId, environment } = props;

  const baseUrl = getBaseUrl();
  const envName = environment ?? getEnvName();
  const apiKey = getApiKey();

  const activityResponse = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/webhooks/${webhookName}/subscription/activities`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "SUBSCRIBE",
        status: "QUEUED",
      }),
    }
  );

  if (activityResponse.ok) {
    console.debug("Uploaded subscribe activity result");
    const json = await activityResponse.json();
    if (!json.id) {
      throw new Error("Missing subscribe activity id");
    }
    return json.id as string;
  } else {
    console.error(
      "Failed to create subscribe activity: ",
      activityResponse.status,
      activityResponse.statusText
    );
    console.error(JSON.stringify(await activityResponse.json(), null, 2));
    throw new Error("Failed to create subscribe activity");
  }
}
