/**
 * OAuth Connector Examples
 *
 * Various examples showing how to create OAuth connectors with different configurations
 */

import { createOAuthConnector } from "../src";

/**
 * Create an OAuth connector with a specific auth URL and token URL
 */

const simpleOAuthConnector = createOAuthConnector()
  .withAuthUrl("https://accounts.google.com/o/oauth2/v2/auth")
  .withTokenUrl("https://oauth2.googleapis.com/token")
  .build();

/**
 * Create a duplicate OAuth connector with a different auth URL and token URL
 */

const duplicateOAuthConnector = createOAuthConnector
  .from(
    createOAuthConnector()
      .withAuthUrl("https://accounts.google.com/o/oauth2/v2/auth")
      .withTokenUrl("https://oauth2.googleapis.com/token")
  )
  .withAuthUrl("https://login.microsoftonline.com/common/oauth2/v2.0/authorize")
  .withTokenUrl("https://login.microsoftonline.com/common/oauth2/v2.0/token")
  .build();

// Export examples for reference
export { simpleOAuthConnector, duplicateOAuthConnector };
