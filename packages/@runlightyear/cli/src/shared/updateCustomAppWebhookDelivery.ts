import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";

export interface UpdateCustomAppWebhookDeliveryProps {
  deliveryId: string;
  customAppName: string;
  deliveryStatus?: string;
  status?: number;
  responseBody?: string;
  endedAt?: "now";
  logs?: any;
}

export async function updateCustomAppWebhookDelivery(
  props: UpdateCustomAppWebhookDeliveryProps
) {
  const {
    deliveryId,
    customAppName,
    deliveryStatus,
    status,
    responseBody,
    endedAt,
    logs,
  } = props;

  const baseUrl = getBaseUrl();
  const envName = getEnvName();
  const apiKey = getApiKey();

  let response;

  try {
    const url = `${baseUrl}/api/v1/projects/default/envs/${envName}/custom-apps/${customAppName}/webhook/deliveries/${deliveryId}`;

    console.debug("updating delivery at", url);

    response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deliveryStatus,
        status,
        responseBody,
        endedAt,
        logs,
      }),
    });
  } catch (error) {
    console.error("Exception thrown ", error);
    return;
  }

  if (response.ok) {
  } else {
    console.error(
      "Failed to upload delivery result",
      response.status,
      response.statusText
    );
    console.error(await response.json());
  }
}
