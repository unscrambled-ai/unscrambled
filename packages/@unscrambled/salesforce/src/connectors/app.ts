import { defineCustomApp, CustomAppBuilder } from "@unscrambled/sdk";
import { createSalesforceOAuthConnector } from "./oauth";

export function defineSalesforceCustomApp(): CustomAppBuilder {
  const salesforceOAuthConnector = createSalesforceOAuthConnector();

  return defineCustomApp("salesforce", "OAUTH2")
    .withTitle("Salesforce")
    .withOAuthConnector(salesforceOAuthConnector);
}
