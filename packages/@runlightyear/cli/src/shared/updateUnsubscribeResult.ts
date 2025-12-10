import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";

export interface UpdateUnsubscribeResultProps {
  subscriptionActivityId: string;
  webhookName: string;
  startedAt?: "now";
  endedAt?: "now";
  status: string;
  logs?: any;
  removed: boolean;
  environment?: string;
}

export default async function updateUnsubscribeResult(
  props: UpdateUnsubscribeResultProps
) {
  const {
    subscriptionActivityId,
    webhookName,
    startedAt,
    endedAt,
    status,
    logs,
    removed,
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
        logs,
      }),
    }
  );

  if (activityResponse.ok) {
    console.debug("Updated unsubscribe activity\n");
  } else {
    console.error(
      "Failed to update unsubscribe activity:",
      activityResponse.status,
      activityResponse.statusText
    );
    console.error(JSON.stringify(await activityResponse.json(), null, 2));
  }

  const unsubscriptionResponse = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/webhooks/${webhookName}/subscription`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status:
          status === "FAILED"
            ? "UNSUBSCRIBE_FAILED"
            : removed
            ? "UNSUBSCRIBED"
            : "NOT_SUBSCRIBED",
      }),
    }
  );

  if (unsubscriptionResponse.ok) {
    console.debug("Uploaded unsubscribe activity\n");
  } else {
    console.error("Failed to update subscription\n");
    console.error(
      JSON.stringify(await unsubscriptionResponse.json(), null, 2),
      "\n"
    );
  }
}
