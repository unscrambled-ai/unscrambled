import { makeApiRequest, getEnvName } from "../utils/api";

export interface RunFuncProps {
  auths?: Record<string, any>;
  variables?: Record<string, string | null>;
  secrets?: Record<string, string | null>;
  webhook?: any;
  integration?: { id: string; name: string; title?: string } | null;
  managedUser?: {
    id: string;
    externalId: string;
    displayName: string | null;
  } | null;
  syncId?: string | null;
  syncRunNumber?: number | null;
}

export async function getRunFuncProps(runId: string): Promise<RunFuncProps> {
  const envName = getEnvName();
  const response = await makeApiRequest(
    `/api/v1/projects/default/envs/${envName}/runs/${runId}/run-func-props`
  );
  return (await response.json()) as RunFuncProps;
}

export interface FinishRunProps {
  runId: string;
  status: "SUCCEEDED" | "FAILED" | "SKIPPED";
  rerun?: boolean;
}

export async function finishRun(props: FinishRunProps): Promise<void> {
  const envName = getEnvName();
  const { runId, status, rerun = false } = props;

  await makeApiRequest(
    `/api/v1/projects/default/envs/${envName}/runs/${runId}/finish`,
    {
      method: "POST",
      data: { status, rerun },
    }
  );
}
