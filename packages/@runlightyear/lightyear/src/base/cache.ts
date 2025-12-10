import baseRequest from "./baseRequest";
import { getEnvName } from "../util/getEnvName";

/**
 * @alpha
 */
export interface SaveCacheProps {
  key: string;
  value: string;
}

/**
 * @alpha
 *
 * @param props
 */
export async function saveCache(props: SaveCacheProps) {
  const envName = getEnvName();
  const { key, value } = props;

  await baseRequest({
    method: "PATCH",
    uri: `/api/v1/projects/default/envs/${envName}/caches/${key}`,
    data: {
      value,
    },
  });
}

/**
 * @alpha
 */
export interface GetCacheProps {
  key: string;
  deployId?: string;
  actionId?: string;
  runId?: string;
}

/**
 * @alpha
 */
export type CacheData = {
  value: string;
};

/**
 * @alpha
 *
 * @param props
 */
export async function getCache(props: GetCacheProps): Promise<string> {
  const envName = getEnvName();
  const { key } = props;

  const response = await baseRequest({
    method: "GET",
    uri: `/api/v1/projects/default/envs/${envName}/caches/${key}`,
  });

  if (!response.ok) {
    throw new Error("Problem getting cache");
  }

  const data = <CacheData>await response.json();

  return data?.value;
}
