import { terminal } from "terminal-kit";
import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";

export interface UploadRefreshSubscriptionResultProps {
  activityId: string;
  webhookName: string;
  startedAt?: "now";
  endedAt?: "now";
  status: string;
  unsubscribeProps?: any;
  logs?: any;
}

export default async function updateRefreshSubscriptionResult(
  props: UploadRefreshSubscriptionResultProps
) {
  const {
    webhookName,
    activityId,
    startedAt,
    endedAt,
    status,
    unsubscribeProps,
    logs,
  } = props;

  const baseUrl = getBaseUrl();
  const envName = getEnvName();
  const apiKey = getApiKey();

  console.debug("about to patch activity", activityId);

  const activityResponse = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/webhooks/${webhookName}/subscription/activities/${activityId}`,
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
    console.debug("Uploaded refresh subscription activity result");
  } else {
    console.error(
      "Failed to upload refresh subscription activity: ",
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
        unsubscribeProps,
      }),
    }
  );

  if (!subscriptionResponse.ok) {
    console.error("Failed to update subscription");
    console.error(JSON.stringify(await subscriptionResponse.json(), null, 2));
  }
}
