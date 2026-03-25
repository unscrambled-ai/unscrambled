import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";
import { parseJsonResponse } from "./parseJsonResponse";

export interface ManagedUserSummary {
  id: string;
  externalId: string;
  displayName: string;
}

export interface TriggerPayload {
  managedUserId?: string;
  managedUserExternalId?: string;
  environment?: string;
  data?: unknown;
}

type TriggerApiResponse = Record<string, unknown> & {
  id?: string;
  runId?: string;
  status?: string;
  message?: string;
};

export type TriggerActionResult =
  | {
      success: true;
      runId?: string;
      status?: string;
      result: TriggerApiResponse;
    }
  | {
      success: false;
      error: string;
      statusCode?: number;
    };

function getRunId(result: TriggerApiResponse): string | undefined {
  if (typeof result.runId === "string") {
    return result.runId;
  }

  if (typeof result.id === "string") {
    return result.id;
  }

  return undefined;
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

  const requestBody: Record<string, unknown> = {
    actionName,
  };
  if (payload.managedUserId !== undefined) {
    requestBody.managedUserId = payload.managedUserId;
  }
  if (payload.managedUserExternalId !== undefined) {
    requestBody.managedUserExternalId = payload.managedUserExternalId;
  }
  if (payload.data !== undefined) {
    requestBody.data = payload.data;
  }

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/default/envs/${envName}/runs`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    const result = (await parseJsonResponse(response, {
      operationName: "trigger action",
    })) as TriggerApiResponse;

    if (!response.ok) {
      return {
        success: false,
        error:
          typeof result.message === "string"
            ? result.message
            : `${response.status} ${response.statusText}`,
        statusCode: response.status,
      };
    }

    return {
      success: true,
      runId: getRunId(result),
      status: typeof result.status === "string" ? result.status : undefined,
      result,
    };
  } catch (error) {
    console.error("Error triggering action:", error);
    return { success: false, error: String(error) };
  }
}
