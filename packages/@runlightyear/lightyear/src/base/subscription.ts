import invariant from "tiny-invariant";
import baseRequest from "./baseRequest";
import { Auths, Secrets, Variables } from "../run";
import { getEnvName } from "../util/getEnvName";
import { getContext } from "./context";

export type SubscriptionStatus =
  | "NOT_SUBSCRIBED"
  | "SUBSCRIBE_FAILED"
  | "SUBSCRIBED"
  | "SUBSCRIBE_ARGS_CHANGED"
  | "UNSUBSCRIBE_FAILED"
  | "UNSUBSCRIBED";

export interface UnsubscribeProps {
  auths: Auths;
  unsubscribeArgs: object;
}

export interface SubscriptionProps {
  name: string;
}

function validateSubscriptionProps({ name }: SubscriptionProps) {
  invariant(name, "Missing required name");
  invariant(typeof name === "string", "Name must be a string");
}

export async function setSubscribeProps(
  envName: string,
  webhookName: string,
  subscribeProps: object
) {
  await baseRequest({
    method: "PUT",
    uri: `/api/v1/projects/default/envs/${envName}/webhooks/${webhookName}/subscribe-props`,
    data: {
      subscribeProps,
    },
  });

  console.debug(`Set webhook ${webhookName} subscribeProps"`, subscribeProps);
}

export async function setUnsubscribeProps(
  envName: string,
  webhookName: string,
  unsubscribeProps: string
) {
  await baseRequest({
    method: "PUT",
    uri: `/api/v1/projects/default/envs/${envName}/webhooks/${webhookName}/unsubscribe-props`,
    data: {
      unsubscribeProps,
    },
  });

  console.info(
    `Set webhook ${webhookName} unsubscribeProps to ${JSON.stringify(
      unsubscribeProps
    )}`
  );
}

export async function updateSubscription(
  envName: string,
  webhookName: string,
  status: SubscriptionStatus,
  unsubscribeProps?: object
) {
  await baseRequest({
    method: "PATCH",
    uri: `/api/v1/projects/default/envs/${envName}/webhooks/${webhookName}/subscription`,
    data: {
      status,
      unsubscribeProps,
    },
  });
}

export async function setSubscriptionExpiresAt(value: string | null) {
  const envName = getEnvName();
  const context = getContext();

  console.debug("in setSubscriptionExpiresAt");
  console.debug("context", context);

  const { webhookName } = context;

  if (!webhookName) {
    throw new Error(
      "setSubscriptionExpiresAt not called from a webhook context"
    );
  }

  return await baseRequest({
    method: "PATCH",
    uri: `/api/v1/projects/default/envs/${envName}/webhooks/${webhookName}/subscription`,
    data: {
      expiresAt: value,
    },
  });
}
