import { terminal } from "terminal-kit";
import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";

export interface DeliverAuthRequestUrlProps {
  localResponseId: string;
  response: string;
}

export async function deliverLocalResponse(props: DeliverAuthRequestUrlProps) {
  const { localResponseId, response } = props;

  const baseUrl = getBaseUrl();
  const envName = getEnvName();
  const apiKey = getApiKey();

  const deliveryResponse = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/local-responses/${localResponseId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        response,
      }),
    }
  );

  if (deliveryResponse.ok) {
    console.debug("Delivered localResponse");
  } else {
    console.error(
      "Failed to deliver localResponse: ",
      deliveryResponse.status,
      deliveryResponse.statusText
    );
    console.error(JSON.stringify(await deliveryResponse.json(), null, 2));
  }
}
