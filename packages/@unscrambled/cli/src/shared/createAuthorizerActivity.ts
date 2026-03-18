import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";

export interface CreateAuthorizerActivityProps {
  customAppName: string;
  type:
    | "GET_AUTH_REQUEST_URL"
    | "REQUEST_ACCESS_TOKEN"
    | "REFRESH_ACCESS_TOKEN";
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  logs?: any;
}

export interface UpdateAuthorizerActivityProps {
  customAppName: string;
  activityId: string;
  status: "SUCCEEDED" | "FAILED";
  logs?: any;
}

export async function createAuthorizerActivity(
  props: CreateAuthorizerActivityProps
) {
  const { customAppName, type, status, logs } = props;

  const baseUrl = getBaseUrl();
  const envName = getEnvName();
  const apiKey = getApiKey();

  const activityResponse = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/custom-apps/${customAppName}/authorizer/activities`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        status,
        logs,
      }),
    }
  );

  if (activityResponse.ok) {
    console.debug("Created authorizer activity");
    const json = await activityResponse.json();
    if (!json.id) {
      throw new Error("Missing Authorizer activity id");
    }
    return json.id as string;
  } else {
    console.error(
      "Failed to create authorizer activity: ",
      activityResponse.status,
      activityResponse.statusText
    );
    console.error(JSON.stringify(await activityResponse.json(), null, 2));
    throw new Error("Failed to create authorizer activity");
  }
}

export async function updateAuthorizerActivity(
  props: UpdateAuthorizerActivityProps
) {
  const { customAppName, activityId, status, logs } = props;

  const baseUrl = getBaseUrl();
  const envName = getEnvName();
  const apiKey = getApiKey();

  const activityResponse = await fetch(
    `${baseUrl}/api/v1/projects/default/envs/${envName}/custom-apps/${customAppName}/authorizer/activities/${activityId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
        logs,
      }),
    }
  );

  if (activityResponse.ok) {
    console.debug("Updated authorizer activity");
    return;
  } else {
    console.error(
      "Failed to update authorizer activity: ",
      activityResponse.status,
      activityResponse.statusText
    );
    console.error(JSON.stringify(await activityResponse.json(), null, 2));
    throw new Error("Failed to update authorizer activity");
  }
}

export default createAuthorizerActivity;
