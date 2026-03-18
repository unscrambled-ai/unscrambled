import { getEnvName } from "../util/getEnvName";
import { getContext } from "./context";
import baseRequest from "./baseRequest";
import { VariableOrSecretDef } from "./variable";

export type SecretDef = VariableOrSecretDef;

/**
 * @internal
 */
export type SecretData = {
  value: string | null;
};

/**
 * Set a secret on the current action or webhook.
 *
 * @param name
 * @param value
 */
export async function setSecret(name: string, value: string | null) {
  const envName = getEnvName();
  const context = getContext();

  const { actionName, webhookName } = context;

  if (actionName) {
    return await baseRequest({
      method: "PATCH",
      uri: `/api/v1/projects/default/envs/${envName}/actions/${actionName}/secrets/${name}`,
      data: {
        value,
      },
    });
  } else if (webhookName) {
    return await baseRequest({
      method: "PATCH",
      uri: `/api/v1/projects/default/envs/${envName}/webhooks/${webhookName}/secrets/${name}`,
      data: {
        value,
      },
    });
  } else {
    throw new Error("setVariable not called from an action or webhook context");
  }
}
