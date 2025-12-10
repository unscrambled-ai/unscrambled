import invariant from "tiny-invariant";
import baseRequest from "./baseRequest";
import { getEnvName } from "../util/getEnvName";
import { getContext } from "./context";

export type VariableOrSecretDef =
  | string
  | { name: string; description?: string };

export type VariableDef = VariableOrSecretDef;

/**
 * @internal
 */
export type VariableData = {
  value: string | null;
};

/**
 * @internal
 *
 * @param name
 */
export async function getVariableData(name: string): Promise<VariableData> {
  const envName = getEnvName();
  invariant(envName, "Missing ENV_NAME");

  const response = await baseRequest({
    method: "GET",
    uri: `/api/v1/projects/default/envs/${envName}/variables/${name}/data`,
  });

  const data = (await response.json()) as VariableData;

  const { value } = data;

  return {
    value,
  };
}

/**
 * Set a variable on the current action or webhook.
 *
 * @param name
 * @param value
 */
export async function setVariable(name: string, value: string | null) {
  const envName = getEnvName();
  const context = getContext();

  const { actionName, webhookName } = context;

  if (actionName) {
    return await baseRequest({
      method: "PATCH",
      uri: `/api/v1/projects/default/envs/${envName}/actions/${actionName}/variables/${name}`,
      data: {
        value,
      },
    });
  } else if (webhookName) {
    return await baseRequest({
      method: "PATCH",
      uri: `/api/v1/projects/default/envs/${envName}/webhooks/${webhookName}/variables/${name}`,
      data: {
        value,
      },
    });
  } else {
    throw new Error("setVariable not called from an action or webhook context");
  }
}
