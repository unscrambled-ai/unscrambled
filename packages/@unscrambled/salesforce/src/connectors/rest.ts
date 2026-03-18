import { createRestConnector } from "@unscrambled/sdk";

// Salesforce uses dynamic instance URL provided in OAuth token response as `instance_url`.
// We store it in auth.extraData.instanceUrl via the OAuth connector's extraData extractor.
const apiVersion = "v57.0";

export function createSalesforceRestConnector() {
  return createRestConnector()
    .withBaseUrl(`{{ auth.extraData.instanceUrl }}/services/data/${apiVersion}`)
    .addHeader("Authorization", "Bearer {{ auth.accessToken }}")
    .build();
}
