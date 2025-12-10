import { pushToDeployList } from "./deploy";
import { getEnvName } from "../util/getEnvName";
import baseRequest from "./baseRequest";
import { HttpProxyResponseError, SKIPPED } from "../index";
import { BaseRequestError } from "./BaseRequestError";
import { getContext } from "./context";

export type MatchPropertyStr = string;
export type MatchNestedProperty = Array<MatchPropertyStr>;
export type MatchObjectProperty = {
  property: MatchPropertySpec;
};
export type MatchPropertySpec = MatchNestedProperty | MatchPropertyStr;
export type MatchCompoundObject =
  | {
      OR: Array<MatchPropertySpec>;
    }
  | {
      AND: Array<MatchPropertySpec>;
    }
  | { OVERLAP: MatchPropertySpec };

export type MatchSpec = MatchPropertySpec | MatchCompoundObject;

export interface ModelProps {
  name: string;
  title: string;
  schema?: unknown;
  matchOn?: MatchSpec;
}

export interface DefineCollectionEnabledProps {
  [modelName: string]: boolean;
}

/**
 * @alpha
 */
export interface DefineCollectionProps {
  name: string;
  title: string;
  models?: Array<ModelProps>;
  enabled?: DefineCollectionEnabledProps;
}

/**
 * @alpha
 */
export interface DeployCollectionProps {
  name: string;
  title: string;
  models?: Array<ModelProps>;
}

/**
 * @alpha
 */
export function defineCollection(props: DefineCollectionProps) {
  console.debug("defineCollection", props);

  const { enabled, ...rest } = props;

  let enabledModels = props.models;
  if (props.models) {
    if (enabled) {
      enabledModels = props.models.filter((model) => {
        return enabled[model.name] ?? false;
      });
    }
  }

  pushToDeployList({
    type: "collection",
    collectionProps: { ...rest, models: enabledModels },
  });

  return props.name;
}

export interface GetModelProps {
  collectionName: string;
}

export interface GetModelResponse {
  name: string;
  title: string;
}

export async function getModels(
  props: GetModelProps
): Promise<Array<GetModelResponse>> {
  const { collectionName } = props;

  const envName = getEnvName();

  const response = await baseRequest({
    method: "GET",
    uri: `/api/v1/projects/default/envs/${envName}/collections/${collectionName}/models`,
  });

  if (response.ok) {
    return await response.json();
  } else {
    throw new Error("Unable to get models");
  }
}

export interface RetrieveDeltaProps {
  collectionName: string;
  syncId: string;
  modelName?: string;
  limit?: number;
}

export async function retrieveDelta<ModelObjectData>(
  props: RetrieveDeltaProps
): Promise<
  | {
      operation: "CREATE";
      changes: Array<{
        changeId: string;
        data: ModelObjectData;
      }>;
    }
  | {
      operation: "UPDATE";
      changes: Array<{
        changeId: string;
        externalId: string;
        data: ModelObjectData;
      }>;
    }
  | {
      operation: "DELETE";
      changes: Array<{
        changeId: string;
        externalId: string;
      }>;
    }
> {
  const MAX_RETRIES = 5;

  const { collectionName, syncId, modelName, limit } = props;

  const envName = getEnvName();

  let retryNumber = 0;

  while (retryNumber < MAX_RETRIES) {
    try {
      try {
        console.debug(
          `retrieveDelta(base) → env=${envName} collection=${collectionName} model=${
            modelName ?? "(all)"
          } sync=${syncId} limit=${limit ?? "none"} attempt=${
            retryNumber + 1
          }/${MAX_RETRIES}`
        );
      } catch {}
      const response = await baseRequest({
        method: "POST",
        uri: `/api/v1/projects/default/envs/${envName}/collections/${collectionName}/delta`,
        data: {
          syncId,
          modelName,
          limit,
        },
      });

      const json = await response.json();
      try {
        const count = Array.isArray(json?.changes) ? json.changes.length : 0;
        console.info(
          `retrieveDelta(base) ✓ operation=${
            json?.operation ?? "(unknown)"
          } count=${count} (sync=${syncId}, model=${modelName ?? "(all)"})`
        );
      } catch {}
      return {
        operation: json.operation,
        changes: json.changes,
      };
    } catch (error) {
      if (error instanceof BaseRequestError) {
        if (error.response.status === 423) {
          retryNumber += 1;
          try {
            console.info(
              `Delta locked (423). Waiting before retry ${retryNumber}/${MAX_RETRIES} (sync=${syncId}, model=${
                modelName ?? "(all)"
              })`
            );
          } catch {}

          // Add exponential backoff with jitter
          const baseWaitTime = Math.pow(2, retryNumber) * 1000; // Exponential backoff
          // const jitter = Math.floor(Math.random() * 5000); // Add up to 5 seconds of jitter
          // const waitTime = baseWaitTime + jitter;
          const waitTime = baseWaitTime;
          try {
            console.info(
              `Waiting ${(waitTime / 1000).toFixed(2)} seconds before retry...`
            );
          } catch {}
          await new Promise((resolve) => setTimeout(resolve, waitTime));

          continue;
        }
      }
      try {
        console.warn(
          `retrieveDelta(base) error on attempt ${
            retryNumber + 1
          }/${MAX_RETRIES} (sync=${syncId}, model=${modelName ?? "(all)"}):`,
          error
        );
      } catch {}
      throw error;
    }
  }

  throw new Error(`Delta timed out after ${MAX_RETRIES} retries`);
}

export interface StartSyncProps {
  collectionName: string;
  managedUserId: string;
  appName: string | null;
  customAppName: string | null;
  fullSyncFrequency?: number;
  type?: "FULL" | "INCREMENTAL";
  timeout?: number;
}

export async function startSync(props: StartSyncProps) {
  const {
    collectionName,
    appName,
    customAppName,
    managedUserId,
    fullSyncFrequency,
    type,
    timeout,
  } = props;

  if (
    typeof fullSyncFrequency !== "undefined" &&
    fullSyncFrequency !== null &&
    typeof type !== "undefined" &&
    type !== null
  ) {
    throw new Error(
      "type and fullSyncFrequency are mutually exclusive; supply only one"
    );
  }

  const envName = getEnvName();

  const { runId } = getContext();

  try {
    const response = await baseRequest({
      method: "POST",
      uri: `/api/v1/projects/default/envs/${envName}/syncs`,
      data: {
        collectionName,
        appName,
        customAppName,
        managedUserId,
        fullSyncFrequency,
        runId,
        type,
        timeout,
      },
    });

    const json = await response.json();
    try {
      const initialModel = json?.currentModel?.name ?? "none";
      const initialCursor = json?.lastBatch?.cursor ?? json?.cursor ?? null;
      const initialPage =
        typeof json?.page === "number"
          ? json.page
          : json?.lastBatch?.page ?? null;
      const initialOffset =
        typeof json?.offset === "number"
          ? json.offset
          : json?.lastBatch?.offset ?? null;
      console.info(
        `startSync(base) state → currentModel=${initialModel} cursor=${
          initialCursor ?? "none"
        } page=${initialPage ?? "none"} offset=${initialOffset ?? "none"}`
      );
    } catch {}
    return json;
  } catch (error) {
    if (error instanceof BaseRequestError) {
      if (error.response.status === 423) {
        console.info("Another sync is running");
        throw SKIPPED;
      }
    }
  }
}

export interface GetSyncProps {
  syncId: string;
}

export async function getSync(props: GetSyncProps) {
  const { syncId } = props;

  const envName = getEnvName();

  const response = await baseRequest({
    method: "GET",
    uri: `/api/v1/projects/default/envs/${envName}/syncs/${syncId}`,
  });

  if (response.ok) {
    return await response.json();
  } else {
    throw new Error("Unable to get sync");
  }
}

export interface UpdateSyncProps {
  syncId: string;
  type?: "FULL" | "INCREMENTAL";
  status?: "PAUSED" | "SUCCEEDED" | "FAILED";
  currentModelName?: string;
  currentDirection?: "PUSH" | "PULL" | null;
}

export async function updateSync(props: UpdateSyncProps) {
  const { syncId, type, status, currentModelName, currentDirection } = props;

  const envName = getEnvName();

  const response = await baseRequest({
    method: "PATCH",
    uri: `/api/v1/projects/default/envs/${envName}/syncs/${syncId}`,
    data: {
      type,
      status,
      currentModelName,
      currentDirection,
    },
  });

  if (response.ok) {
    return await response.json();
  } else {
    throw new Error("Unable to update sync");
  }
}

export interface UpsertObjectProps {
  collection: string;
  syncId: string;
  model: string;
  app: string | undefined;
  customApp: string | undefined;
  managedUserId?: string | null;
  objectId?: string;
  localObjectId: string;
  localUpdatedAt: string | null;
  data: unknown;
  overwrite?: boolean;
}

export async function upsertObject(props: UpsertObjectProps) {
  const {
    collection,
    syncId,
    model,
    app,
    customApp,
    managedUserId,
    objectId,
    localObjectId,
    localUpdatedAt,
    data,
    overwrite,
  } = props;

  const envName = getEnvName();

  const response = await baseRequest({
    method: "POST",
    uri: `/api/v1/projects/default/envs/${envName}/collections/${collection}/models/${model}/objects/upsert`,
    data: {
      syncId,
      appName: app,
      customAppName: customApp,
      managedUserId,
      objectId,
      localObjectId,
      localUpdatedAt,
      data,
      overwrite,
    },
  });

  console.info(
    "Upsert",
    collection,
    model,
    localObjectId,
    response.status,
    response.statusText
  );

  return response;
}

export interface UpsertObjectBatchProps {
  collectionName: string;
  syncId: string;
  modelName: string;
  app: string | undefined;
  customApp: string | undefined;
  managedUserId?: string | null;
  objects: Array<{
    objectId?: string;
    externalId: string;
    externalUpdatedAt: string | null;
    data: {
      [key: string]: unknown;
    };
  }>;
  cursor?: string;
  overwrite?: boolean;
  async?: boolean;
}

export async function upsertObjectBatch(props: UpsertObjectBatchProps) {
  const {
    collectionName,
    syncId,
    modelName,
    app,
    customApp,
    managedUserId,
    objects,
    overwrite,
    async,
    cursor,
  } = props;

  const envName = getEnvName();

  const response = await baseRequest({
    method: "POST",
    uri: `/api/v1/projects/default/envs/${envName}/collections/${collectionName}/models/${modelName}/objects/upsert/batch`,
    data: {
      syncId,
      appName: app,
      customAppName: customApp,
      managedUserId,
      objects,
      overwrite,
      async,
      cursor,
    },
  });

  console.info(
    "Upsert",
    collectionName,
    modelName,
    objects.length,
    response.status,
    response.statusText
  );

  return response;
}

export interface ConfirmChangeProps {
  syncId: string;
  changeId: string;
  externalId: string;
  externalUpdatedAt: string | null;
}

export async function confirmChange(props: ConfirmChangeProps) {
  const { syncId, changeId, externalId, externalUpdatedAt } = props;

  const envName = getEnvName();

  const response = await baseRequest({
    method: "POST",
    uri: `/api/v1/projects/default/envs/${envName}/syncs/${syncId}/changes/${changeId}/confirm`,
    data: {
      externalId,
      externalUpdatedAt,
    },
  });

  console.info(
    "Confirm",
    changeId,
    externalId,
    externalUpdatedAt,
    response.status,
    response.statusText
  );

  return response;
}

export interface ConfirmChangeBatchProps {
  syncId: string;
  changes: Array<{
    changeId: string;
    externalId: string;
    externalUpdatedAt: string | null;
  }>;
  async?: boolean;
}

export async function confirmChangeBatch(props: ConfirmChangeBatchProps) {
  const { syncId, changes, async } = props;

  const envName = getEnvName();

  const response = await baseRequest({
    method: "POST",
    uri: `/api/v1/projects/default/envs/${envName}/syncs/${syncId}/changes/batch/confirm`,
    data: {
      changes,
      async,
    },
  });
}

export interface ConfirmObjectBatchProps {
  collection: string;
  syncId: string;
  model: string;
  app: string | undefined;
  customApp: string | undefined;
  managedUserId?: string | null;
  objects: Array<{
    objectId?: string;
    localObjectId: string;
    localUpdatedAt: string | null;
    data: unknown;
  }>;
  overwrite?: boolean;
  async?: boolean;
}

export async function confirmObjectBatch(props: ConfirmObjectBatchProps) {
  const {
    collection,
    syncId,
    model,
    app,
    customApp,
    managedUserId,
    objects,
    overwrite,
    async,
  } = props;

  const envName = getEnvName();

  const response = await baseRequest({
    method: "POST",
    uri: `/api/v1/projects/default/envs/${envName}/collections/${collection}/models/${model}/objects/confirm/batch`,
    data: {
      syncId,
      appName: app,
      customAppName: customApp,
      managedUserId,
      objects,
      overwrite,
      async,
    },
  });

  console.info(
    "Confirm",
    collection,
    model,
    objects.length,
    response.status,
    response.statusText
  );

  return response;
}

export interface DeleteObjectProps {
  collection: string;
  model: string;
  customApp: string;
  managedUserExternalId?: string;
  externalId: string;
}

export async function deleteObject(props: DeleteObjectProps) {
  const { collection, model, customApp, managedUserExternalId, externalId } =
    props;

  const envName = getEnvName();

  const response = await baseRequest({
    method: "POST",
    uri: `/api/v1/projects/default/envs/${envName}/collections/${collection}/models/${model}/objects/delete`,
    data: {
      customAppName: customApp,
      managedUserExternalId,
      externalId,
    },
  });

  console.info(
    "Delete object",
    collection,
    model,
    externalId,
    response.status,
    response.statusText
  );

  return response;
}

export interface GetLastUpdatedObjectProps {
  collection: string;
  model: string;
  app: string | null;
  customApp: string | null;
  managedUserExternalId: string | null;
}

export async function getLastUpdatedObject(props: GetLastUpdatedObjectProps) {
  const { collection, model, app, customApp, managedUserExternalId } = props;

  const envName = getEnvName();

  const response = await baseRequest({
    method: "POST",
    uri: `/api/v1/projects/default/envs/${envName}/collections/${collection}/models/${model}/objects/last-updated`,
    data: {
      appName: app,
      customAppName: customApp,
      managedUserExternalId,
    },
  });

  return await response.json();
}

export interface DetectHardDeletesProps {
  collection: string;
  model: string;
  customApp: string;
  managedUserExternalId: string;
  remainingIds: Array<string>;
}

export async function detectHardDeletes(props: DetectHardDeletesProps) {
  const envName = getEnvName();
  const { collection, model, customApp, managedUserExternalId, remainingIds } =
    props;

  return baseRequest({
    method: "POST",
    uri: `/api/v1/projects/default/envs/${envName}/collections/${collection}/models/${model}/objects/detect-hard-deletes`,
    data: {
      remainingIds,
    },
  });
}

export async function pauseSync(syncId: string) {
  const envName = getEnvName();

  const response = await baseRequest({
    method: "POST",
    uri: `/api/v1/projects/default/envs/${envName}/syncs/${syncId}/pause`,
  });

  if (response.ok) {
    console.info("Sync paused");
  } else {
    throw new Error("Unable to pause sync");
  }

  return response;
}

export async function finishSync(syncId: string) {
  const envName = getEnvName();

  return baseRequest({
    method: "POST",
    uri: `/api/v1/projects/default/envs/${envName}/syncs/${syncId}/finish`,
  });
}
