import baseRequest from "./baseRequest";
import invariant from "tiny-invariant";
import { getEnvName } from "../util/getEnvName";

interface Props {
  webhookName: string;
  type: "SUBSCRIBE" | "UNSUBSCRIBE";
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  logs: string[];
}

export async function createSubscriptionActivity({
  webhookName,
  type,
  status,
  logs,
}: Props) {
  const envName = getEnvName();
  invariant(envName, "Missing ENV_NAME");

  return await baseRequest({
    method: "POST",
    uri: `/api/v1/projects/default/envs/${envName}/webhooks/${webhookName}/subscription/activities`,
    data: {
      type,
      status,
      logs,
    },
  });
}
