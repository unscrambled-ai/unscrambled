import { terminal } from "terminal-kit";
import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";

export interface UploadSubscribeResultProps {
  subscriptionActivityId: string;
  webhookName: string;
  startedAt?: "now";
  endedAt?: "now";
  status: string;
  unsubscribeProps?: any;
  deployId: string;
  logs?: any;
  environment?: string;
}

export default async function updateSubscribeResult(
  props: UploadSubscribeResultProps
) {
  const {
    webhookName,
    subscriptionActivityId,
    startedAt,
    endedAt,
    status,
    unsubscribeProps,
    logs,
    deployId,
    environment,
  } = props;

  const baseUrl = getBaseUrl();
  const envName = environment ?? getEnvName();
  const apiKey = getApiKey();

  const activityResponse = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/webhooks/${webhookName}/subscription/activities/${subscriptionActivityId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
        startedAt,
        endedAt,
        unsubscribeProps,
        logs,
      }),
    }
  );

  if (activityResponse.ok) {
    console.debug("Uploaded subscribe activity result");
  } else {
    console.error(
      "Failed to upload subscribe activity: ",
      activityResponse.status,
      activityResponse.statusText
    );
    console.error(JSON.stringify(await activityResponse.json(), null, 2));
  }

  const subscriptionResponse = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/webhooks/${webhookName}/subscription`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: status === "FAILED" ? "SUBSCRIBE_FAILED" : "SUBSCRIBED",
        unsubscribeProps,
        deployId,
      }),
    }
  );

  if (!subscriptionResponse.ok) {
    console.error("Failed to update subscription");
    console.error(JSON.stringify(await subscriptionResponse.json(), null, 2));
  }
}
