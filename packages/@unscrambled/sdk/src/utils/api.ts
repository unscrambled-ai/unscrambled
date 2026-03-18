/**
 * Utility functions for making API requests to Unscrambled platform
 */

export interface AuthData {
  managedUser: {
    id: string;
    externalId: string;
  } | null;
  appName: string | null;
  customAppName: string | null;
  authName: string;
  username: string | null;
  password: string | null;
  apiKey: string | null;
  tokenType?: string | null;
  state?: string | null;
  codeVerifier?: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt?: string | null;
  refreshedAt?: string | null;
  extraData?: Record<string, any> | null;
  customAppData?: {
    oAuthConfigData: {
      clientId: string;
      clientSecret: string;
      authRequestUrl?: string;
      [key: string]: any;
    };
    extraData: object;
    extraSecrets: object;
  };
}

export interface GetAuthDataProps {
  customAppName: string;
  authName: string;
}

export interface UpdateAuthDataProps {
  appName?: string;
  customAppName?: string;
  authName: string;
  authData: AuthData;
}

/**
 * Get environment name from process.env
 */
export function getEnvName(): string {
  return process.env.ENV_NAME || "dev";
}

/**
 * Get base URL from process.env
 */
export function getBaseUrl(): string {
  return process.env.BASE_URL || "https://app.unscrambled.ai";
}

/**
 * Get API key from process.env
 */
export function getApiKey(): string | undefined {
  return process.env.UNSCRAMBLED_API_KEY || process.env.API_KEY;
}

/**
 * Make authenticated API request to Unscrambled platform
 */
export async function makeApiRequest(
  uri: string,
  options: {
    method?: string;
    data?: any;
  } = {}
): Promise<Response> {
  const { method = "GET", data } = options;

  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();
  const envName = getEnvName();

  if (!baseUrl) {
    throw new Error("Missing BASE_URL environment variable");
  }

  if (!apiKey) {
    throw new Error(
      "Missing API key. Set UNSCRAMBLED_API_KEY or API_KEY environment variable."
    );
  }

  if (!envName) {
    throw new Error("Missing ENV_NAME environment variable");
  }

  const url = `${baseUrl}${uri}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };

  const requestOptions: RequestInit = {
    method,
    headers,
  };

  // Tie all requests to the run's abort signal so we can stop immediately on cancellation
  try {
    const { getRunAbortSignal } = await import("../logging/index.js");
    (requestOptions as any).signal = getRunAbortSignal();
  } catch {}

  if (data && method !== "GET") {
    headers["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(data);
  }

  console.debug(`Making API request: ${method} ${url}`);

  // Exponential backoff on transient errors and network failures
  const maxAttempts = 5; // total attempts including the first
  let attempt = 1;
  while (true) {
    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        const status = response.status;
        // Use categorizer to decide retry policy
        const { categorizeHttpStatus } = await import("./httpErrors.js");
        const isRetriable = categorizeHttpStatus(status) === "temporary";
        const errorText = await response.text().catch(() => "");

        if (isRetriable && attempt < maxAttempts) {
          const waitMs =
            Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 5000);
          console.warn(
            `Transient API error (${status}). Retrying in ${(
              waitMs / 1000
            ).toFixed(2)}s (attempt ${attempt}/${maxAttempts})`
          );
          await new Promise((r) => setTimeout(r, waitMs));
          attempt += 1;
          continue;
        }

        const err = new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        ) as Error & { status?: number };
        err.status = status;
        throw err;
      }

      return response;
    } catch (err: any) {
      // Network-level errors (e.g., DNS, timeouts)
      const isNetworkError =
        typeof err === "object" && err !== null && !("status" in (err as any));
      // Do not retry if the run was canceled/aborted
      try {
        const { isRunCanceled } = await import("../logging/index.js");
        if (
          (typeof err?.name === "string" && err.name === "AbortError") ||
          isRunCanceled()
        ) {
          const canceled: any = new Error("RUN_CANCELED");
          canceled.code = "RUN_CANCELED";
          throw canceled;
        }
      } catch {}
      if (isNetworkError && attempt < maxAttempts) {
        const waitMs =
          Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 5000);
        console.warn(
          `Network error calling API. Retrying in ${(waitMs / 1000).toFixed(
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
 * Get OAuth configuration data for a custom app from Unscrambled platform
 */
export async function getAuthData(props: GetAuthDataProps): Promise<AuthData> {
  console.debug("Getting auth data from Unscrambled platform");

  const { customAppName, authName } = props;
  const envName = getEnvName();

  const uri = `/api/v1/projects/default/envs/${envName}/custom-apps/${customAppName}/auths/${authName}/data`;

  try {
    const response = await makeApiRequest(uri);
    const data = (await response.json()) as AuthData;

    console.debug(
      `Successfully retrieved auth data for ${customAppName}/${authName}`
    );

    return data;
  } catch (error) {
    console.error(
      `Failed to get auth data for ${customAppName}/${authName}:`,
      error
    );
    throw error;
  }
}

/**
 * Update OAuth auth data for a custom app in Unscrambled platform
 */
export async function updateAuthData(
  props: UpdateAuthDataProps
): Promise<void> {
  console.debug("Updating auth data in Unscrambled platform");

  const { appName, customAppName, authName, authData } = props;

  if (!customAppName && !appName) {
    throw new Error("Must specify customAppName or appName");
  }

  if (customAppName && appName) {
    throw new Error("Only specify customAppName or appName, not both");
  }

  const envName = getEnvName();

  // Use appropriate URI based on app type
  const uri = appName
    ? `/api/v1/projects/default/envs/${envName}/apps/${appName}/auths/${authName}/data`
    : `/api/v1/projects/default/envs/${envName}/custom-apps/${customAppName}/auths/${authName}/data`;

  try {
    console.info(
      `💾 Saving OAuth tokens to platform for ${
        customAppName || appName
      }/${authName}...`
    );

    const response = await makeApiRequest(uri, {
      method: "PATCH",
      data: authData,
    });

    console.info(`✅ Successfully saved OAuth tokens to platform`);
    console.debug(
      `Auth data updated for ${customAppName || appName}/${authName}`
    );
  } catch (error) {
    console.error(
      `Failed to update auth data for ${customAppName || appName}/${authName}:`,
      error
    );
    throw error;
  }
}
