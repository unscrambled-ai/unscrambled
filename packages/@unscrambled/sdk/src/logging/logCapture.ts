interface LogEntry {
  level: "DEBUG" | "INFO" | "WARN" | "ERROR" | "LOG";
  message: string;
  timestamp: string;
  position?: number;
}

interface LogUploadPayload {
  deployId?: string;
  runId?: string;
  deliveryId?: string;
  subscriptionActivityId?: string;
  authorizerActivityId?: string;
  logs: LogEntry[];
}

interface LogCaptureConfig {
  uploadIntervalMs?: number;
  maxLogsPerBatch?: number;
  baseUrl?: string;
  environment?: string;
  apiKey?: string;
}

class RunCanceledError extends Error {
  constructor(message: string = "Run canceled") {
    super(message);
    this.name = "RunCanceledError";
  }
}

let runCanceled = false;
let runCancelListeners: Array<() => void> = [];
let runAbortController: AbortController | null = null;

function notifyRunCanceledInternal(): void {
  if (runCanceled) return;
  runCanceled = true;
  try {
    // Abort any in-flight requests
    try {
      runAbortController?.abort();
    } catch {}
    // Notify listeners synchronously
    for (const listener of runCancelListeners) {
      try {
        listener();
      } catch {
        // ignore individual listener errors
      }
    }
  } finally {
    runCancelListeners = [];
  }
}

export function onRunCanceled(listener: () => void): () => void {
  if (runCanceled) {
    // Already canceled, invoke immediately
    try {
      listener();
    } catch {}
    return () => {};
  }
  runCancelListeners.push(listener);
  return () => {
    runCancelListeners = runCancelListeners.filter((l) => l !== listener);
  };
}

export function getRunCancellationPromise(): Promise<void> {
  if (runCanceled) return Promise.resolve();
  return new Promise<void>((resolve) => {
    onRunCanceled(() => resolve());
  });
}

export function isRunCanceled(): boolean {
  return runCanceled;
}

export function resetRunCancellation(): void {
  runCanceled = false;
  runCancelListeners = [];
  try {
    // Guard for environments without AbortController
    // @ts-ignore
    if (typeof AbortController !== "undefined") {
      runAbortController = new AbortController();
      // Increase max listeners to avoid warnings when many parallel requests share the signal
      // This is safe because we're using a single abort controller for the entire run
      try {
        // setMaxListeners is available on EventTarget in Node.js
        const signal = runAbortController.signal as any;
        if (typeof signal?.setMaxListeners === "function") {
          signal.setMaxListeners(1000);
        }
      } catch {
        // Ignore if setMaxListeners is not available
      }
    } else {
      runAbortController = null;
    }
  } catch {
    runAbortController = null;
  }
}

export const RUN_CANCELED_ERROR_CODE = "RUN_CANCELED" as const;

export function getRunAbortSignal(): AbortSignal {
  if (!runAbortController) {
    try {
      // @ts-ignore
      if (typeof AbortController !== "undefined") {
        runAbortController = new AbortController();
        // Increase max listeners to avoid warnings when many parallel requests share the signal
        try {
          // setMaxListeners is available on EventTarget in Node.js
          const signal = runAbortController.signal as any;
          if (typeof signal?.setMaxListeners === "function") {
            signal.setMaxListeners(1000);
          }
        } catch {
          // Ignore if setMaxListeners is not available
        }
      }
    } catch {}
  }
  // If AbortController is not available, return undefined at runtime (typed as AbortSignal)
  return runAbortController?.signal ?? (undefined as unknown as AbortSignal);
}

class LogCapture {
  private logs: LogEntry[] = [];
  private uploadTimer: NodeJS.Timeout | null = null;
  private originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  };
  private config: Required<LogCaptureConfig>;
  private isCapturing = false;
  private secrets: Set<string> = new Set();
  private currentContext: {
    runId?: string;
    deployId?: string;
    deliveryId?: string;
    subscriptionActivityId?: string;
    authorizerActivityId?: string;
    syncId?: string;
    modelName?: string;
    integrationName?: string;
    managedUserId?: string;
    managedUserExternalId?: string;
    managedUserDisplayName?: string | null;
  } = {};

  constructor(config: LogCaptureConfig = {}) {
    this.originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };

    this.config = {
      uploadIntervalMs: config.uploadIntervalMs || 1000,
      maxLogsPerBatch: config.maxLogsPerBatch || 1000,
      baseUrl:
        config.baseUrl ||
        process.env.BASE_URL ||
        process.env.LIGHTYEAR_BASE_URL ||
        "https://app.runlightyear.com",
      environment:
        config.environment ||
        process.env.ENV_NAME ||
        process.env.LIGHTYEAR_ENV ||
        "dev",
      apiKey:
        config.apiKey ||
        process.env.LIGHTYEAR_API_KEY ||
        process.env.API_KEY ||
        "",
    };
  }

  /**
   * Start capturing console logs
   */
  startCapture(): void {
    if (this.isCapturing) {
      return;
    }

    this.isCapturing = true;

    // Intercept console methods
    console.log = this.createInterceptor("LOG", this.originalConsole.log);
    console.info = this.createInterceptor("INFO", this.originalConsole.info);
    console.warn = this.createInterceptor("WARN", this.originalConsole.warn);
    console.error = this.createInterceptor("ERROR", this.originalConsole.error);
    console.debug = this.createInterceptor("DEBUG", this.originalConsole.debug);

    // Start periodic upload
    this.startPeriodicUpload();
  }

  /**
   * Add secrets to redact from subsequent logs
   */
  addSecrets(secrets: Array<string | null>): void {
    for (const s of secrets) {
      if (typeof s === "string" && s.length > 0) {
        this.secrets.add(s);
      }
    }
  }

  /**
   * Redact all known secrets from a given string
   */
  private redact(text: string): string {
    if (!text || this.secrets.size === 0) return text;
    let result = text;
    for (const secret of this.secrets) {
      try {
        if (!secret) continue;
        const mask = `*****${secret.slice(-3)}`;
        // Simple replace; if secret appears multiple times, replace all
        result = result.split(secret).join(mask);
      } catch {
        // ignore any unexpected errors during redaction
      }
    }
    return result;
  }

  /**
   * Stop capturing console logs
   */
  stopCapture(): void {
    if (!this.isCapturing) {
      return;
    }

    this.isCapturing = false;

    // Restore original console methods
    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.debug = this.originalConsole.debug;

    // Stop periodic upload
    if (this.uploadTimer) {
      clearInterval(this.uploadTimer);
      this.uploadTimer = null;
    }

    // Upload any remaining logs
    this.uploadLogs();
  }

  /**
   * Set context for log uploads (runId, deployId, etc.)
   */
  setContext(context: {
    runId?: string;
    deployId?: string;
    deliveryId?: string;
    subscriptionActivityId?: string;
    authorizerActivityId?: string;
    syncId?: string;
    modelName?: string;
    integrationName?: string;
    managedUserId?: string;
    managedUserExternalId?: string;
    managedUserDisplayName?: string | null;
  }): void {
    this.currentContext = { ...this.currentContext, ...context };

    // If we have uploadable context and pending logs, trigger an immediate upload
    if (this.hasUploadableContext() && this.logs.length > 0) {
      setTimeout(() => this.uploadLogs(), 100); // Small delay to avoid blocking
    }
  }

  /**
   * Clear the current context
   */
  clearContext(): void {
    // Do a final upload before clearing context
    if (this.hasUploadableContext() && this.logs.length > 0) {
      this.uploadLogs();
    }

    this.currentContext = {};
  }

  /**
   * Get the current context (for internal use)
   */
  getContext(): {
    runId?: string;
    deployId?: string;
    deliveryId?: string;
    subscriptionActivityId?: string;
    authorizerActivityId?: string;
    syncId?: string;
    modelName?: string;
    integrationName?: string;
    managedUserId?: string;
    managedUserExternalId?: string;
    managedUserDisplayName?: string | null;
  } {
    return { ...this.currentContext };
  }

  /**
   * Create an interceptor for a console method
   */
  private createInterceptor(
    level: LogEntry["level"],
    originalMethod: (...args: any[]) => void
  ) {
    return (...args: any[]) => {
      const rawMessage = args
        .map((arg) => {
          if (typeof arg === "string") {
            return arg;
          } else if (typeof arg === "object") {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          } else {
            return String(arg);
          }
        })
        .join(" ");

      const redactedMessage = this.redact(rawMessage);

      // Truncate message if it exceeds 240000 bytes
      const maxLogSize = 240000;
      const truncationMessage = "\n[truncated]";
      let finalMessage = redactedMessage;

      if (redactedMessage.length > maxLogSize) {
        finalMessage =
          redactedMessage.substring(0, maxLogSize - truncationMessage.length) +
          truncationMessage;
      }

      // Print truncated message to original console
      originalMethod(finalMessage);

      // Capture the truncated log
      if (this.isCapturing) {
        this.addLog({
          level,
          message: finalMessage,
          timestamp: new Date().toISOString(),
          position: this.logs.length,
        });
      }
    };
  }

  /**
   * Add a log entry to the buffer
   */
  private addLog(entry: LogEntry): void {
    this.logs.push(entry);

    // Prevent memory issues by limiting log count
    if (this.logs.length > this.config.maxLogsPerBatch * 2) {
      this.logs = this.logs.slice(-this.config.maxLogsPerBatch);
    }
  }

  /**
   * Start periodic upload of logs
   */
  private startPeriodicUpload(): void {
    this.uploadTimer = setInterval(() => {
      if (this.logs.length > 0 && !isRunCanceled()) {
        this.uploadLogs();
      }
    }, this.config.uploadIntervalMs);
  }

  /**
   * Upload logs to the API
   */
  private async uploadLogs(): Promise<void> {
    if (isRunCanceled()) {
      this.logs = [];
      return;
    }

    if (this.logs.length === 0) {
      return;
    }

    // Only upload if we have a context that requires it (like runId)
    if (!this.hasUploadableContext()) {
      return;
    }

    if (!this.config.apiKey) {
      return;
    }

    const logsToUpload = this.logs.slice(0, this.config.maxLogsPerBatch);
    this.logs = this.logs.slice(this.config.maxLogsPerBatch);

    // Only send recognized context fields; keep any extra fields internal
    const cleanContext = {
      runId: this.currentContext.runId,
      deployId: this.currentContext.deployId,
      deliveryId: this.currentContext.deliveryId,
      subscriptionActivityId: this.currentContext.subscriptionActivityId,
      authorizerActivityId: this.currentContext.authorizerActivityId,
    };

    const payload: LogUploadPayload = {
      ...cleanContext,
      logs: logsToUpload,
    };

    try {
      await this.sendLogsToAPI(payload);
      // Single debug message about successful upload
      this.originalConsole.debug(
        `📤 Uploaded ${logsToUpload.length} log${
          logsToUpload.length !== 1 ? "s" : ""
        } to backend`
      );
    } catch (error) {
      if (error instanceof RunCanceledError) {
        // Do not requeue logs; the server will no longer accept them for this run
        this.logs = [];
        return;
      }
      // If upload fails otherwise, put logs back (but don't let them accumulate indefinitely)
      this.logs = [...logsToUpload.slice(-100), ...this.logs];

      // Use original console to avoid infinite recursion
      this.originalConsole.error("❌ Failed to upload logs:", error);
    }
  }

  /**
   * Check if we have a context that requires log upload
   */
  private hasUploadableContext(): boolean {
    return !!(
      this.currentContext.runId ||
      this.currentContext.deployId ||
      this.currentContext.deliveryId ||
      this.currentContext.subscriptionActivityId ||
      this.currentContext.authorizerActivityId
    );
  }

  /**
   * Send logs to the API endpoint
   */
  private async sendLogsToAPI(payload: LogUploadPayload): Promise<void> {
    if (!this.config.apiKey) {
      return; // Skip upload if no API key
    }

    const url = `${this.config.baseUrl}/api/v1/projects/default/envs/${this.config.environment}/logs`;
    const body = JSON.stringify(payload);

    const maxAttempts = 5; // total attempts including first
    let attempt = 1;
    while (true) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
            "User-Agent": "@unscrambled/sdk",
            "X-SDK-Version": "0.1.0",
          },
          signal: getRunAbortSignal(),
          body,
        });

        if (!response.ok) {
          if (response.status === 410) {
            // Signal cancellation to the rest of the system
            notifyRunCanceledInternal();
            // Clear buffer; further uploads will be rejected
            this.logs = [];
            throw new RunCanceledError();
          }
          const retriable =
            response.status === 429 ||
            (response.status >= 500 && response.status < 600);
          if (retriable && attempt < maxAttempts) {
            const waitMs =
              Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 5000);
            this.originalConsole.warn(
              `Log upload transient error ${response.status}. Retrying in ${(
                waitMs / 1000
              ).toFixed(2)}s (attempt ${attempt}/${maxAttempts})`
            );
            await new Promise((r) => setTimeout(r, waitMs));
            attempt += 1;
            continue;
          }
          throw new Error(
            `Log upload failed: ${response.status} ${response.statusText}`
          );
        }

        break;
      } catch (err: any) {
        if (err instanceof RunCanceledError) {
          // Do not retry cancellations
          throw err;
        }
        const isNetworkError = err && !("status" in (err as any));
        if (isNetworkError && attempt < maxAttempts) {
          const waitMs =
            Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 5000);
          this.originalConsole.warn(
            `Log upload network error. Retrying in ${(waitMs / 1000).toFixed(
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

  /**
   * Get current log count (for debugging)
   */
  getLogCount(): number {
    return this.logs.length;
  }

  /**
   * Get captured logs for processing (without uploading)
   */
  getLogs(): LogEntry[] {
    return [...this.logs]; // Return a copy to prevent external modification
  }

  /**
   * Manually flush logs (for testing)
   */
  async flush(): Promise<void> {
    await this.uploadLogs();
  }
}

// Global log capture instance
let globalLogCapture: LogCapture | null = null;

/**
 * Initialize global log capture
 */
export function initializeLogCapture(config?: LogCaptureConfig): LogCapture {
  if (globalLogCapture) {
    globalLogCapture.stopCapture();
  }

  // Reset cancellation state for a new operation
  resetRunCancellation();

  globalLogCapture = new LogCapture(config);
  globalLogCapture.startCapture();
  return globalLogCapture;
}

/**
 * Get the global log capture instance
 */
export function getLogCapture(): LogCapture | null {
  return globalLogCapture;
}

/**
 * Set context for log uploads
 */
export function setLogContext(context: {
  runId?: string;
  deployId?: string;
  deliveryId?: string;
  subscriptionActivityId?: string;
  authorizerActivityId?: string;
}): void {
  if (globalLogCapture) {
    globalLogCapture.setContext(context);
  }
}

/**
 * Get the current context (for internal use by HTTP requests and sync operations)
 */
export function getCurrentContext(): {
  runId?: string;
  deployId?: string;
  deliveryId?: string;
  subscriptionActivityId?: string;
  authorizerActivityId?: string;
  syncId?: string;
  modelName?: string;
  integrationName?: string;
  managedUserId?: string;
  managedUserExternalId?: string;
  managedUserDisplayName?: string | null;
} {
  return globalLogCapture?.getContext() || {};
}

/**
 * Clear log context
 */
export function clearLogContext(): void {
  if (globalLogCapture) {
    globalLogCapture.clearContext();
  }
}

/**
 * Stop log capture and cleanup
 */
export function stopLogCapture(): void {
  if (globalLogCapture) {
    globalLogCapture.stopCapture();
    globalLogCapture = null;
  }
}

export { LogCapture };
export type { LogEntry, LogUploadPayload, LogCaptureConfig };

/**
 * Add secrets to redact in subsequent logs (no-op if capture not started).
 */
export function addLogRedactionSecrets(secrets: Array<string | null>): void {
  try {
    if (!globalLogCapture) return;
    (globalLogCapture as any).addSecrets?.(secrets);
  } catch {
    // ignore
  }
}
