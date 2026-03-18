import type { InternalResponse } from "./types";
import { OAuthConnector } from "../connectors/OAuthConnector";
import { getCustomApps } from "../registry";
import { getAuthData } from "../utils/api";

export interface HandleGetAuthRequestUrlProps {
  customAppName: string;
  authName: string;
  // These would typically come from a registry/global index
  oauthConfigData?: any;
  authData?: any;
  oauthConnector?: OAuthConnector;
}

export interface HandleRequestAccessTokenProps {
  customAppName: string;
  authName: string;
  code: string;
  // These would typically come from a registry/global index
  oauthConfigData?: any;
  authData?: any;
  oauthConnector?: OAuthConnector;
}

export interface HandleRefreshAccessTokenProps {
  customAppName: string;
  authName: string;
  // These would typically come from a registry/global index
  oauthConfigData?: any;
  authData?: any;
  oauthConnector?: OAuthConnector;
}

/**
 * Helper function to get OAuth connector from registry with platform auth data
 */
async function getOAuthConnectorFromRegistry(
  customAppName: string,
  authName: string,
  providedOauthConfigData?: any,
  providedAuthData?: any
): Promise<OAuthConnector | undefined> {
  console.info(
    `🔍 Looking up OAuth connector for custom app: ${customAppName}`
  );

  const customApps = getCustomApps();
  console.info(`📋 Found ${customApps.length} custom apps in registry`);

  const customApp = customApps.find(
    (entry) => entry.customApp.name === customAppName
  );

  if (!customApp) {
    console.error(`❌ Custom app '${customAppName}' not found in registry`);
    console.error(
      `📋 Available custom apps: ${customApps
        .map((app) => app.customApp.name)
        .join(", ")}`
    );
    return undefined;
  }

  console.info(`✅ Found custom app '${customAppName}' in registry`);
  console.info(`   Title: ${customApp.customApp.title || "N/A"}`);
  console.info(`   Type: ${customApp.customApp.type}`);

  if (!customApp.customApp.oauthConnector) {
    console.error(
      `❌ No OAuth connector configured for custom app '${customAppName}'`
    );
    return undefined;
  }

  console.info(
    `🔐 OAuth connector found for ${customAppName}, preparing instance...`
  );

  const connectorFactory = customApp.customApp.oauthConnector;

  // Try to get OAuth config data from the platform if not provided
  let oauthConfigData = providedOauthConfigData;
  let authData = providedAuthData;

  if (!oauthConfigData || !authData) {
    try {
      console.info(
        `🌐 Fetching OAuth credentials from platform for ${customAppName}/${authName}...`
      );
      const platformAuthData = await getAuthData({ customAppName, authName });

      if (!oauthConfigData && platformAuthData.customAppData?.oAuthConfigData) {
        oauthConfigData = platformAuthData.customAppData.oAuthConfigData;
        const hasClientId = !!oauthConfigData.clientId;
        const hasClientSecret = !!oauthConfigData.clientSecret;
        console.info(`✅ Retrieved OAuth config from platform:`);
        console.info(
          `   Client ID: ${hasClientId ? "✅ Configured" : "❌ Missing"}`
        );
        console.info(
          `   Client Secret: ${
            hasClientSecret ? "✅ Configured" : "❌ Missing"
          }`
        );

        if (oauthConfigData.clientId) {
          const redactedClientId =
            oauthConfigData.clientId.length > 8
              ? `${oauthConfigData.clientId.substring(
                  0,
                  4
                )}...${oauthConfigData.clientId.substring(
                  oauthConfigData.clientId.length - 4
                )}`
              : "[REDACTED]";
          console.info(`   Client ID Value: ${redactedClientId}`);
        }
      }

      if (!authData) {
        authData = platformAuthData;
        console.info(`✅ Retrieved auth data from platform`);
      }
    } catch (error) {
      console.warn(
        `⚠️  Failed to fetch auth data from platform, using empty config:`,
        error
      );
      console.info(
        `🔄 Continuing with empty config (OAuth URL generation will still work)`
      );
      // Continue with empty config - connector will work for getAuthRequestUrl
      oauthConfigData = oauthConfigData || {};
      authData = authData || {};
    }
  }

  // Create connector props from config and auth data
  const connectorProps = {
    oauthConfigData: oauthConfigData || {},
    authData: authData || {},
    customAppName,
    authName,
  };

  try {
    // Cast to function to handle TypeScript union type issues
    const factory = connectorFactory as Function;
    return factory(connectorProps) as OAuthConnector;
  } catch (error) {
    console.error(`Failed to create OAuth connector instance:`, error);
    return undefined;
  }
}

/**
 * Handle getting OAuth authorization request URL
 */
export async function handleGetAuthRequestUrl(
  props: HandleGetAuthRequestUrlProps
): Promise<InternalResponse> {
  console.debug("Getting auth request url");

  const { customAppName, authName, oauthConfigData, authData, oauthConnector } =
    props;

  if (!customAppName) {
    return {
      success: false,
      error: "Missing customAppName",
      logs: ["[ERROR] Missing customAppName"],
    };
  }

  if (!authName) {
    return {
      success: false,
      error: "Missing authName",
      logs: ["[ERROR] Missing authName"],
    };
  }

  try {
    let finalConnector = oauthConnector;

    // If no connector provided, try to find it from the registry
    if (!finalConnector) {
      finalConnector = await getOAuthConnectorFromRegistry(
        customAppName,
        authName,
        oauthConfigData,
        authData
      );

      if (!finalConnector) {
        return {
          success: false,
          error: `No OAuth connector configured for custom app '${customAppName}'`,
          logs: [
            `[ERROR] No OAuth connector configured for custom app '${customAppName}'`,
          ],
        };
      }
    }

    console.info(`🔗 Using OAuth connector for custom app: ${customAppName}`);
    console.info(`🔑 Auth name: ${authName}`);

    const authRequestUrl = finalConnector.getAuthRequestUrl();

    console.info("🎯 OAuth Authorization Flow Ready!");
    console.info("==================================");
    console.info(`📱 Custom App: ${customAppName}`);
    console.info(`🔐 Auth Name: ${authName}`);
    console.info(`🌐 Authorization URL: ${authRequestUrl}`);
    console.info("");
    console.info("👤 Next Steps:");
    console.info("   1. User will be redirected to the authorization URL");
    console.info("   2. User grants permissions to the application");
    console.info("   3. User is redirected back with authorization code");
    console.info("   4. Code can be exchanged for access token");

    return {
      success: true,
      data: { authRequestUrl },
      logs: [], // Logs will be captured and added by the main handler
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to get auth request url", errorMessage);
    return {
      success: false,
      error: errorMessage,
      logs: [`[ERROR] Failed to get auth request url: ${errorMessage}`],
    };
  }
}

/**
 * Handle OAuth access token request (code exchange)
 */
export async function handleRequestAccessToken(
  props: HandleRequestAccessTokenProps
): Promise<InternalResponse> {
  console.debug("Requesting access token");

  const {
    customAppName,
    authName,
    code,
    oauthConfigData,
    authData,
    oauthConnector,
  } = props;

  if (!customAppName) {
    return {
      success: false,
      error: "Missing customAppName",
      logs: ["[ERROR] Missing customAppName"],
    };
  }

  if (!authName) {
    return {
      success: false,
      error: "Missing authName",
      logs: ["[ERROR] Missing authName"],
    };
  }

  if (!code) {
    return {
      success: false,
      error: "Missing code",
      logs: ["[ERROR] Missing code"],
    };
  }

  try {
    let finalConnector = oauthConnector;

    // If no connector provided, try to find it from the registry
    if (!finalConnector) {
      finalConnector = await getOAuthConnectorFromRegistry(
        customAppName,
        authName,
        oauthConfigData,
        authData
      );

      if (!finalConnector) {
        return {
          success: false,
          error: `No OAuth connector configured for custom app '${customAppName}'`,
          logs: [
            `[ERROR] No OAuth connector configured for custom app '${customAppName}'`,
          ],
        };
      }
    }

    console.debug(`Using OAuth connector for ${customAppName}`);

    const newAuthData = await finalConnector.requestAccessToken(code);

    console.info("Requested access token successfully");

    return {
      success: true,
      data: { authData: newAuthData },
      logs: [], // Logs will be captured and added by the main handler
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to request access token", errorMessage);
    return {
      success: false,
      error: errorMessage,
      logs: [`[ERROR] Failed to request access token: ${errorMessage}`],
    };
  }
}

/**
 * Handle OAuth access token refresh
 */
export async function handleRefreshAccessToken(
  props: HandleRefreshAccessTokenProps
): Promise<InternalResponse> {
  console.debug("Refreshing access token");

  const { customAppName, authName, oauthConfigData, authData, oauthConnector } =
    props;

  if (!customAppName) {
    return {
      success: false,
      error: "Missing customAppName",
      logs: ["[ERROR] Missing customAppName"],
    };
  }

  if (!authName) {
    return {
      success: false,
      error: "Missing authName",
      logs: ["[ERROR] Missing authName"],
    };
  }

  try {
    let finalConnector = oauthConnector;

    // If no connector provided, try to find it from the registry
    if (!finalConnector) {
      finalConnector = await getOAuthConnectorFromRegistry(
        customAppName,
        authName,
        oauthConfigData,
        authData
      );

      if (!finalConnector) {
        return {
          success: false,
          error: `No OAuth connector configured for custom app '${customAppName}'`,
          logs: [
            `[ERROR] No OAuth connector configured for custom app '${customAppName}'`,
          ],
        };
      }
    }

    console.debug(`Using OAuth connector for ${customAppName}`);

    const newAuthData = await finalConnector.refreshAccessToken();

    console.info("Refreshed access token");

    return {
      success: true,
      data: { authData: newAuthData },
      logs: [], // Logs will be captured and added by the main handler
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to refresh access token", errorMessage);
    return {
      success: false,
      error: errorMessage,
      logs: [`[ERROR] Failed to refresh access token: ${errorMessage}`],
    };
  }
}
