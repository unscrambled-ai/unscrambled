import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";

export interface ManagedUserSummary {
  id: string;
  externalId: string;
  displayName: string;
}

export interface TriggerPayload {
  managedUserId?: string;
  managedUserExternalId?: string;
  environment?: string;
}

export interface TriggerActionResult {
  success: boolean;
  error?: string;
}

export async function getManagedUsers(
  environment?: string
): Promise<ManagedUserSummary[]> {
  const baseUrl = getBaseUrl();
  const envName = environment ?? getEnvName();
  const apiKey = getApiKey();

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/default/envs/${envName}/managed-users`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      console.debug("Failed to fetch managed users:", response.status);
      return [];
    }

    const data = await response.json();
    return data.managedUsers || [];
  } catch (error) {
    console.debug("Error fetching managed users:", error);
    return [];
  }
}

export async function triggerAction(
  actionName: string,
  payload: TriggerPayload = {}
): Promise<TriggerActionResult> {
  const baseUrl = getBaseUrl();
  const envName = payload.environment ?? getEnvName();
  const apiKey = getApiKey();

  const requestBody: Record<string, unknown> = {};
  if (payload.managedUserId !== undefined) {
    requestBody.managedUserId = payload.managedUserId;
  }
  if (payload.managedUserExternalId !== undefined) {
    requestBody.managedUserExternalId = payload.managedUserExternalId;
  }

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/default/envs/${envName}/actions/${actionName}/trigger`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Failed to trigger action: ${response.status} ${response.statusText}`
      );
      if (errorText) {
        console.debug("Error response:", errorText);
      }
      return {
        success: false,
        error: `${response.status} ${response.statusText}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error triggering action:", error);
    return { success: false, error: String(error) };
  }
}
