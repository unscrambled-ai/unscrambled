import { defineCustomApp, CustomAppBuilder } from "@unscrambled/sdk";
import { createHubSpotOAuthConnector } from "./oauth";

export function defineHubSpotCustomApp(): CustomAppBuilder {
  const hubspotOAuthConnector = createHubSpotOAuthConnector();

  return defineCustomApp("hubspot", "OAUTH2")
    .withTitle("HubSpot")
    .withOAuthConnector(hubspotOAuthConnector)
    .addVariable("appId");
}
