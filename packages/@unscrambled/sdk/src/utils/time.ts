const DEFAULT_TIME_LIMIT_MS = 1 * 60 * 1000;

let startTimeMs: number | null = null;
let limitOverrideMs: number | null = null;

export function resetTimeLimit(limitMs?: number): void {
  startTimeMs = Date.now();
  limitOverrideMs =
    typeof limitMs === "number" && Number.isFinite(limitMs) && limitMs > 0
      ? limitMs
      : null;
}

export function isTimeLimitExceeded(limitMs?: number): boolean {
  if (startTimeMs == null) startTimeMs = Date.now();
  const effectiveLimitMs =
    typeof limitMs === "number"
      ? limitMs
      : limitOverrideMs ?? DEFAULT_TIME_LIMIT_MS;
  return Date.now() - startTimeMs > effectiveLimitMs;
}
