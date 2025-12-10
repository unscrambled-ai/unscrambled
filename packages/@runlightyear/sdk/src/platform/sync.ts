import {
  makeApiRequest,
  getApiKey,
  getBaseUrl,
  getEnvName,
} from "../utils/api";

export interface GetModelsResponseItem {
  name: string;
  title?: string;
}

export async function getModels(props: {
  collectionName: string;
}): Promise<Array<GetModelsResponseItem>> {
  const { collectionName } = props;
  const envName = process.env.ENV_NAME || "dev";
  const response = await makeApiRequest(
    `/api/v1/projects/default/envs/${envName}/collections/${collectionName}/models`
  );
  return (await response.json()) as Array<GetModelsResponseItem>;
}

/**
 * Create a new sync run on the platform and return the created sync record.
 */
export async function startSync(props: {
  collectionName: string;
  appName?: string | null;
  customAppName?: string | null;
  managedUserId?: string;
  fullSyncFrequency?: number;
  runId?: string;
  type?: "FULL" | "INCREMENTAL" | "BASELINE";
  timeout?: number;
}): Promise<any> {
  const envName = getEnvName();
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();

  if (
    typeof props.fullSyncFrequency !== "undefined" &&
    props.fullSyncFrequency !== null &&
    typeof props.type !== "undefined" &&
    props.type !== null
  ) {
    throw new Error(
      "type and fullSyncFrequency are mutually exclusive; supply only one"
    );
  }

  const url = `${baseUrl}/api/v1/projects/default/envs/${envName}/syncs`;
  const body = JSON.stringify({
    collectionName: props.collectionName,
    appName: props.appName ?? null,
    customAppName: props.customAppName ?? null,
    managedUserId: props.managedUserId ?? null,
    fullSyncFrequency: props.fullSyncFrequency,
    runId: props.runId ?? null,
    type: props.type,
    timeout: props.timeout,
  });

  try {
    console.info(
      `startSync → env=${envName} collection=${props.collectionName} app=${
        props.appName ?? "none"
      } customApp=${props.customAppName ?? "none"} managedUser=${
        props.managedUserId ?? "none"
      } fullFrequency=${props.fullSyncFrequency ?? "default"} type=${
        props.type ?? "auto"
      } timeout=${props.timeout ?? "default"}`
    );
    // Preview payload keys only; avoid logging full body
    console.debug("startSync payload keys:", {
      collectionName: props.collectionName,
      appName: props.appName ?? null,
      customAppName: props.customAppName ?? null,
      hasManagedUserId: !!props.managedUserId,
      fullSyncFrequency: props.fullSyncFrequency ?? null,
      runId: props.runId ?? null,
      type: props.type ?? null,
      timeout: props.timeout ?? null,
    });
  } catch {}

  const maxAttempts = 5; // total attempts including the first
  let attempt = 1;
  while (true) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
      });

      if (response.status === 423) {
        console.warn("Another sync is running (423 Locked) — skipping");
        throw "SKIPPED";
      }

      if (response.status === 429) {
        const errorText = await response.text().catch(() => "");
        let reason = "Too many requests";
        try {
          const parsed = JSON.parse(errorText);
          if (parsed?.message) reason = parsed.message;
        } catch {}
        console.warn(`Rate limited (429): ${reason} — skipping`);
        throw "SKIPPED";
      }

      if (
        response.status >= 500 &&
        response.status < 600 &&
        attempt < maxAttempts
      ) {
        const waitMs =
          Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 5000);
        console.warn(
          `startSync transient error ${response.status}. Retrying in ${(
            waitMs / 1000
          ).toFixed(2)}s (attempt ${attempt}/${maxAttempts})`
        );
        await new Promise((r) => setTimeout(r, waitMs));
        attempt += 1;
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const json = await response.json();
      try {
        console.info(
          `startSync ✓ created sync id=${json?.id ?? "unknown"} type=${
            json?.type ?? "unknown"
          }`
        );
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
          `startSync state → currentModel=${initialModel} cursor=${
            initialCursor ?? "none"
          } page=${initialPage ?? "none"} offset=${initialOffset ?? "none"}`
        );
      } catch {}
      return json;
    } catch (err: any) {
      const isNetworkError =
        typeof err === "object" && err !== null && !("status" in (err as any));
      if (isNetworkError && attempt < maxAttempts) {
        const waitMs =
          Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 5000);
        console.warn(
          `startSync network error. Retrying in ${(waitMs / 1000).toFixed(
            2
          )}s (attempt ${attempt}/${maxAttempts})`
        );
        await new Promise((r) => setTimeout(r, waitMs));
        attempt += 1;
        continue;
      }
      throw err;
    }
  }
}

export async function getSync(props: { syncId: string }): Promise<any> {
  const envName = process.env.ENV_NAME || "dev";
  const response = await makeApiRequest(
    `/api/v1/projects/default/envs/${envName}/syncs/${props.syncId}`
  );
  return await response.json();
}

export async function updateSync(props: {
  syncId: string;
  type?: "FULL" | "INCREMENTAL" | "BASELINE";
  status?: "PAUSED" | "SUCCEEDED" | "FAILED";
  currentModelName?: string;
  currentDirection?: "PUSH" | "PULL" | null;
}): Promise<any> {
  const envName = process.env.ENV_NAME || "dev";
  const response = await makeApiRequest(
    `/api/v1/projects/default/envs/${envName}/syncs/${props.syncId}`,
    {
      method: "PATCH",
      data: {
        type: props.type,
        status: props.status,
        currentModelName: props.currentModelName,
        currentDirection: props.currentDirection,
      },
    }
  );
  return await response.json();
}

export async function pauseSync(syncId: string): Promise<void> {
  const envName = process.env.ENV_NAME || "dev";
  await makeApiRequest(`/api/v1/projects/default/envs/${envName}/syncs/${syncId}/pause`, {
    method: "POST",
  });
}

export async function continueSync(syncId: string): Promise<void> {
  const envName = getEnvName();
  console.warn(`⚠️ [DEBUG] Calling continueSync for syncId=${syncId}`);
  const response = await makeApiRequest(`/api/v1/projects/default/envs/${envName}/syncs/${syncId}/continue`, {
    method: "POST",
  });
  
  // Dump all response headers for debugging
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  
  console.warn(`⚠️ [DEBUG] continueSync completed: syncId=${syncId} status=${response.status} headers=${JSON.stringify(headers)}`);
}

export async function finishSync(
  syncId: string,
  options?: { error?: string; force?: boolean }
): Promise<void> {
  const envName = getEnvName();
  const url = `/api/v1/projects/default/envs/${envName}/syncs/${syncId}/finish`;
  const bodyObj: any = {};
  if (options?.error) bodyObj.error = options.error;
  if (typeof options?.force === "boolean") bodyObj.force = options.force;

  try {
    console.info(
      `finishSync → env=${envName} sync=${syncId} error=${
        options?.error ? "yes" : "no"
      } force=${options?.force ?? false}`
    );
  } catch {}

  const hasBody = Object.keys(bodyObj).length > 0;
  const response = await makeApiRequest(url, {
    method: "POST",
    data: hasBody ? bodyObj : undefined,
  });

  const text = await response.text().catch(() => "");
  try {
    const json = text ? JSON.parse(text) : {};
    console.info(`finishSync ✓ response message=${json?.message ?? "(none)"}`);
  } catch {
    console.info("finishSync ✓ (no JSON body)");
  }
}

export async function upsertObjectBatch(props: {
  collectionName: string;
  syncId: string;
  modelName: string;
  app?: string | undefined;
  customApp?: string | undefined;
  objects: Array<{
    objectId?: string;
    externalId: string;
    externalUpdatedAt: string | null;
    data: Record<string, unknown>;
  }>;
  cursor?: string;
  page?: number;
  offset?: number;
  overwrite?: boolean;
  async?: boolean;
}): Promise<void> {
  const envName = process.env.ENV_NAME || "dev";
  const count = props.objects?.length ?? 0;
  console.info(
    `📤 upsertObjectBatch: model=${props.modelName} count=${count} async=${
      props.async ?? false
    }`
  );
  await makeApiRequest(
    `/api/v1/projects/default/envs/${envName}/collections/${props.collectionName}/models/${props.modelName}/objects/upsert/batch`,
    {
      method: "POST",
      data: {
        syncId: props.syncId,
        appName: props.app,
        customAppName: props.customApp,
        objects: props.objects,
        overwrite: props.overwrite,
        async: props.async,
        cursor: props.cursor,
        page: props.page,
        offset: props.offset,
      },
    }
  );
  console.info(
    `✅ Submitted ${props.objects.length} objects for model=${props.modelName}`
  );
}

export async function retrieveDelta<T = any>(props: {
  collectionName: string;
  syncId: string;
  modelName: string;
  limit?: number;
}): Promise<
  | {
      operation: "CREATE";
      changes: Array<{ changeId: string; data: T }>;
    }
  | {
      operation: "UPDATE";
      changes: Array<{ changeId: string; externalId: string; data: T }>;
    }
  | {
      operation: "DELETE";
      changes: Array<{ changeId: string; externalId: string }>;
    }
> {
  const MAX_RETRIES = 5;
  const envName = getEnvName();
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error(
      "Missing API key. Set LIGHTYEAR_API_KEY or API_KEY environment variable."
    );
  }

  const url = `${baseUrl}/api/v1/projects/default/envs/${envName}/collections/${props.collectionName}/delta`;

  let retryNumber = 0;
  while (retryNumber < MAX_RETRIES) {
    try {
      try {
        console.debug(
          `retrieveDelta → env=${envName} collection=${
            props.collectionName
          } model=${props.modelName} sync=${props.syncId} limit=${
            props.limit ?? "none"
          } attempt=${retryNumber + 1}/${MAX_RETRIES}`
        );
      } catch {}
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          syncId: props.syncId,
          modelName: props.modelName,
          limit: props.limit,
        }),
      });

      if (response.status === 423) {
        retryNumber += 1;
        const waitTime =
          Math.pow(2, retryNumber) * 1000 + Math.floor(Math.random() * 5000);
        try {
          console.info(
            `Delta locked (423). Waiting ${(waitTime / 1000).toFixed(
              2
            )}s before retry ${retryNumber}/${MAX_RETRIES} (sync=${
              props.syncId
            }, model=${props.modelName})`
          );
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      if (
        response.status === 429 ||
        (response.status >= 500 && response.status < 600)
      ) {
        retryNumber += 1;
        if (retryNumber >= MAX_RETRIES) {
          const errorText = await response.text().catch(() => "");
          throw new Error(
            `API request failed: ${response.status} ${response.statusText} - ${errorText}`
          );
        }
        const waitTime =
          Math.pow(2, retryNumber) * 1000 + Math.floor(Math.random() * 5000);
        try {
          console.warn(
            `Transient error ${response.status} on retrieveDelta. Waiting ${(
              waitTime / 1000
            ).toFixed(2)}s before retry ${retryNumber}/${MAX_RETRIES} (sync=${
              props.syncId
            }, model=${props.modelName})`
          );
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const payload = (await response.json()) as any;
      try {
        const count = Array.isArray(payload?.changes)
          ? payload.changes.length
          : 0;
        console.info(
          `retrieveDelta ✓ operation=${
            payload?.operation ?? "(unknown)"
          } count=${count} (sync=${props.syncId}, model=${props.modelName})`
        );
      } catch {}
      return payload;
    } catch (err: any) {
      // network error
      retryNumber += 1;
      if (retryNumber >= MAX_RETRIES) {
        const finalMessage =
          err instanceof Error ? err.message : String(err ?? "unknown error");
        try {
          console.error(
            `retrieveDelta ✗ exhausted retries (${MAX_RETRIES}). Last error: ${finalMessage} (sync=${props.syncId}, model=${props.modelName})`
          );
        } catch {}
        throw err;
      }
      const waitTime =
        Math.pow(2, retryNumber) * 1000 + Math.floor(Math.random() * 5000);
      try {
        console.warn(
          `retrieveDelta network error. Waiting ${(waitTime / 1000).toFixed(
            2
          )}s before retry ${retryNumber}/${MAX_RETRIES} (sync=${
            props.syncId
          }, model=${props.modelName})`
        );
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      continue;
    }
  }

  throw new Error(`Delta timed out after ${MAX_RETRIES} retries`);
}

export async function confirmChangeBatch(props: {
  syncId: string;
  changes: Array<{
    changeId: string;
    externalId: string;
    externalUpdatedAt?: string | null;
  }>;
  async?: boolean;
}): Promise<void> {
  const envName = process.env.ENV_NAME || "dev";

  const response = await makeApiRequest(
    `/api/v1/projects/default/envs/${envName}/syncs/${props.syncId}/changes/batch/confirm`,
    {
      method: "POST",
      data: {
        changes: props.changes,
        async: props.async,
      },
    }
  );
}

export async function getUnconfirmedChanges(props: {
  syncId: string;
  limit?: number;
  cursor?: string;
}): Promise<{
  httpRequests: Array<{
    httpRequest: {
      id: string;
      method: string;
      url: string;
      statusCode: number;
      statusText: string;
      requestHeaders: Record<string, string>;
      requestBody: string;
      responseHeaders: Record<string, string>;
      responseBody: string;
      createdAt: string;
      startedAt: string;
      endedAt: string;
      idPath?: string;
      updatedAtPath?: string;
    };
    modelName: string;
    changeIds: string[];
  }>;
  nextCursor: string | null;
  pendingWritesCount: number;
}> {
  const envName = getEnvName();
  console.debug(`Fetching unconfirmed HTTP requests for sync ${props.syncId}`);
  const response = await makeApiRequest(
    `/api/v1/projects/default/envs/${envName}/http-requests/unconfirmed`,
    {
      method: "POST",
      data: {
        syncId: props.syncId,
        limit: props.limit ?? 100,
        cursor: props.cursor,
      },
    }
  );
  const payload = await response.json();

  console.debug("Unconfirmed HTTP requests payload structure:", {
    hasHttpRequests: payload && "httpRequests" in payload,
    hasNextCursor: payload && "nextCursor" in payload,
    hasPendingWritesCount: payload && "pendingWritesCount" in payload,
    payloadKeys:
      payload && typeof payload === "object" ? Object.keys(payload) : undefined,
  });

  const httpRequests = payload?.httpRequests ?? [];
  const nextCursor = payload?.nextCursor ?? null;
  const pendingWritesCount = payload?.pendingWritesCount ?? 0;

  console.debug(
    `Returning ${
      httpRequests.length
    } unconfirmed HTTP requests, pendingWritesCount=${pendingWritesCount}, hasNextCursor=${!!nextCursor}`
  );

  return { httpRequests, nextCursor, pendingWritesCount };
}
