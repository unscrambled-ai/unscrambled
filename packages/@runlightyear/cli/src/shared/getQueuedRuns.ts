import { getApiKey } from "./getApiKey";
import { getBaseUrl } from "./getBaseUrl";
import { getEnvName } from "./getEnvName";
import { terminal } from "terminal-kit";

export interface QueuedRunItem {
  id: string;
  actionName: string;
  createdAt: string;
  data?: object;
  deliveryId?: string;
}

export default async function getQueuedRuns(
  environment?: string
): Promise<Array<QueuedRunItem>> {
  const baseUrl = getBaseUrl();
  const envName = environment ?? getEnvName();
  const apiKey = getApiKey();

  try {
    const url = `${baseUrl}/api/v1/projects/default/envs/${envName}/runs?runStatus=QUEUED`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      terminal.red(
        `Failed to retrieve queued runs: ${response.status} ${response.statusText}\n`
      );
      try {
        const text = await response.text();
        console.error(text);
      } catch {}
      return [];
    }

    let payload: any;
    try {
      payload = await response.json();
    } catch (error) {
      console.error("Unable to parse queued runs response", error);
      return [];
    }

    const rawItems = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.runs)
      ? payload.runs
      : [];

    if (rawItems.length === 0) {
      console.debug(
        `No queued runs returned for env '${envName}'. Raw payload:`,
        payload
      );
    }

    const normalizedItems: QueuedRunItem[] = rawItems
      .map((item: any) => {
        const actionName =
          item?.actionName ??
          item?.action?.name ??
          item?.action_name ??
          item?.action?.actionName ??
          item?.action?.title ??
          null;

        if (!actionName) {
          console.warn(
            "Queued run is missing actionName. Raw item:",
            JSON.stringify(item, null, 2)
          );
          return null;
        }

        return {
          id: item.id,
          actionName,
          createdAt:
            item.createdAt ?? item.created_at ?? new Date().toISOString(),
          data: item.data ?? item.payload ?? undefined,
          deliveryId: item.deliveryId ?? item.delivery_id ?? undefined,
        };
      })
      .filter(Boolean) as QueuedRunItem[];

    // Sort by creation time ascending to process oldest first
    return normalizedItems.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  } catch (error) {
    console.error("Error fetching queued runs", error);
    return [];
  }
}
