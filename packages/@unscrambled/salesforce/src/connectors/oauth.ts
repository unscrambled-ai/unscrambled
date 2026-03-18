import { createOAuthConnector } from "@unscrambled/sdk";

export function createSalesforceOAuthConnector() {
  return createOAuthConnector()
    .withAuthUrl("https://login.salesforce.com/services/oauth2/authorize")
    .withTokenUrl("https://login.salesforce.com/services/oauth2/token")
    .withScope(["full", "refresh_token"]) // default useful scopes
    .withExtraData((data) => ({
      instanceUrl: data["instance_url"],
    }))
    .withExpiresAt(() => new Date(Date.now() + 60 * 60 * 1000).toISOString())
    .build();
}
