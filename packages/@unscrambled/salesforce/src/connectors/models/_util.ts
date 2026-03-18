export interface ListRequestProps {
  cursor?: string;
}

export function buildQueryRequest(
  props: ListRequestProps | undefined,
  soql: string
) {
  if (props?.cursor) {
    return {
      endpoint: `/query/${props.cursor}`,
      method: "GET" as const,
    };
  }
  return {
    endpoint: "/query/",
    method: "GET" as const,
    params: { q: soql },
  };
}

export function getPagination(response: { nextRecordsUrl?: string | null }) {
  const next = response?.nextRecordsUrl || null;
  if (!next) return { cursor: undefined as string | undefined, hasMore: false };
  const parts = next.split("/query/");
  const cursor = parts.length > 1 ? parts[1] : undefined;
  return { cursor, hasMore: !!cursor };
}
