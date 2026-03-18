import {
  createOAuthConnector,
  createRestConnector,
  defineCrmCollection,
  defineIntegration,
  defineAction,
} from "@unscrambled/sdk";
import {
  defineHubSpotCustomApp,
  createHubSpotSyncConnector,
  createHubSpotOAuthConnector,
} from "../src";
import { HUBSPOT_SCOPES } from "../src/types/HubSpotScope";

// Example 1: Default HubSpot OAuth connector (preconfigured)
const hubspotOAuthConnector = createHubSpotOAuthConnector().withScope([
  "crm.objects.companies.read",
  "crm.objects.contacts.read",
  "crm.objects.deals.read",
  "crm.objects.owners.read",
  "oauth",
]);

// Example 1b: Custom OAuth scopes (type-safe) using the generic builder
const hubspotOAuthConnectorWithCustomScopes = createOAuthConnector()
  .withAvailableScope(HUBSPOT_SCOPES)
  .withAuthUrl("https://app.hubspot.com/oauth/authorize")
  .withTokenUrl("https://api.hubapi.com/oauth/v1/token")
  .withScope([
    // Only read scopes
    "crm.objects.companies.read",
    "crm.objects.contacts.read",
    "crm.objects.deals.read",
    "crm.objects.owners.read",
    "oauth",
    // Add additional scopes
    "content",
    // "forms2", // ❌ Uncomment to see a compile-time error: not in HUBSPOT_SCOPES
    "tickets",
  ])
  .build();

// Example 2: Custom REST connector with different base URL or headers
const hubspotRestConnectorEU = createRestConnector()
  .withBaseUrl("https://api.hubapi.eu/crm/v3") // EU data center
  .addHeader("Authorization", "Bearer {{ auth.accessToken }}")
  .addHeader("X-Custom-Header", "CustomValue")
  .build();

// Example 3: Using API key authentication instead of OAuth
const hubspotRestConnectorApiKey = createRestConnector()
  .withBaseUrl("https://api.hubapi.com/crm/v3")
  .addHeader("Authorization", "Bearer {{ secrets.HUBSPOT_API_KEY }}")
  .build();

// Example 4: Custom app with additional variables and secrets
// Note: You can override the default OAuth connector if needed
const hubspotCustomApp = defineHubSpotCustomApp()
  .withTitle("HubSpot Custom") // Override the default title
  .withOAuthConnector(hubspotOAuthConnector) // Use convenience OAuth connector
  .addVariable("portalId", { required: true }) // Additional variable
  .addVariable("region", { required: false }) // EU or US
  .addSecret("webhookSecret", { required: false })
  .deploy();

// Create collection and sync connector
const crmCollection = defineCrmCollection()
  .withOnlyModels("contact", "account")
  .deploy();

const hubspotSyncConnector = createHubSpotSyncConnector(
  hubspotRestConnectorEU,
  crmCollection
).build();

// Integration with conditional logic based on variables
defineIntegration("hubspot-custom-config")
  .withTitle("HubSpot Custom Configuration")
  .withCustomApp(hubspotCustomApp)
  .withActions(
    defineAction("region-aware-sync")
      .addVariable("region")
      .withRun(async ({ variables }) => {
        const region = variables.region || "US";
        console.log(`Syncing from ${region} region`);

        // You could create different connectors based on region
        if (region === "EU") {
          await hubspotSyncConnector.sync();
        } else {
          // Use US connector
          const usConnector = createRestConnector()
            .withBaseUrl("https://api.hubapi.com/crm/v3")
            .addHeader("Authorization", "Bearer {{ auth.accessToken }}")
            .build();

          const usSyncConnector = createHubSpotSyncConnector(
            usConnector,
            crmCollection
          ).build();

          await usSyncConnector.sync();
        }
      })
      .deploy(),

    defineAction("portal-specific-action")
      .addVariable("portalId")
      .withRun(async ({ variables }) => {
        const portalId = variables.portalId;
        console.log(`Working with portal: ${portalId}`);

        // Use portal ID in API calls
        const response = await hubspotRestConnectorEU.get({
          url: `objects/contacts`,
          params: {
            limit: 10,
            // Some endpoints might use portalId
          },
        });

        console.log("Contacts:", response.data);
      })
      .deploy()
  )
  .deploy();
