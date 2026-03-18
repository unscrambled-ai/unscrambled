import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";

export interface GetCustomAppWebhookDelivery {
  customAppName: string;
  deliveryId: string;
}

export async function getCustomAppWebhookDelivery(
  props: GetCustomAppWebhookDelivery
) {
  const baseUrl = getBaseUrl();
  const envName = getEnvName();
  const apiKey = getApiKey();

  const { customAppName, deliveryId } = props;

  console.debug("Fetching delivery for customApp", customAppName, deliveryId);

  const response = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/custom-apps/${customAppName}/webhook/deliveries/${deliveryId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  console.debug(
    "Back from fetching delivery for customApp",
    customAppName,
    deliveryId
  );

  if (response.ok) {
    return await response.json();
  } else {
    throw new Error("Error fetching delivery");
  }
}
