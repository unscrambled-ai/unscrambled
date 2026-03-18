import baseRequest from "./baseRequest";
import invariant from "tiny-invariant";
import { AuthData } from "./auth";
import { getEnvName } from "../util/getEnvName";
import { prefixedRedactedConsole } from "../logging";
import { HttpProxyRequestHeaders } from "./http";

export interface RunFuncAuths {
  [name: string]: AuthData;
}

export interface RunFuncVariables {
  [name: string]: string | null;
}

export interface RunFuncSecrets {
  [name: string]: string | null;
}

export interface RunFuncWebhook {
  url: string;
  method: string;
  headers: HttpProxyRequestHeaders;
}

export interface RunFuncIntegration {
  id: string;
  name: string;
  title: string;
}

export interface RunFuncManagedUser {
  id: string;
  externalId: string;
  displayName: string | null;
}

export interface RunFuncProps {
  auths: RunFuncAuths;
  variables: RunFuncVariables;
  secrets: RunFuncSecrets;
  webhook: string | null;
  integration: RunFuncIntegration | null;
  managedUser: RunFuncManagedUser | null;
}

export async function getRunFuncProps(runId: string): Promise<RunFuncProps> {
  const envName = getEnvName();
  invariant(envName, "Missing ENV_NAME");

  const response = await baseRequest({
    method: "GET",
    uri: `/api/v1/projects/default/envs/${envName}/runs/${runId}/run-func-props`,
  });

  const runFuncProps = <RunFuncProps>await response.json();

  const { auths, variables, secrets, integration, managedUser, webhook } =
    runFuncProps;

  for (const auth of Object.values(auths)) {
    const { accessToken, refreshToken, apiKey } = auth;

    accessToken && prefixedRedactedConsole.addSecrets([accessToken]);
    refreshToken && prefixedRedactedConsole.addSecrets([refreshToken]);
    apiKey && prefixedRedactedConsole.addSecrets([apiKey]);
  }

  prefixedRedactedConsole.addSecrets(Object.values(secrets));

  return {
    auths,
    variables,
    secrets,
    webhook,
    integration,
    managedUser,
  };
}

export interface FinishRunProps {
  runId: string;
  status: "SUCCEEDED" | "FAILED" | "SKIPPED";
  rerun?: boolean;
}

export async function finishRun(props: FinishRunProps) {
  const envName = getEnvName();
  invariant(envName, "Missing ENV_NAME");

  const { runId, status, rerun = false } = props;

  await baseRequest({
    method: "POST",
    uri: `/api/v1/projects/default/envs/${envName}/runs/${runId}/finish`,
    data: { status, rerun },
  });
}
