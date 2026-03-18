import {
  defineCollection,
  defineCrmCollection,
  defineIntegration,
  defineAction,
} from "@unscrambled/sdk";
import {
  defineHubSpotCustomApp,
  createHubSpotRestConnector,
  createHubSpotSyncConnector,
} from "../src";

// Define a custom collection with only specific models
const minimalCrmCollection = defineCollection("minimal-crm")
  .withTitle("Minimal CRM")
  .addModel("contact", {
    title: "Contact",
    schema: {
      type: "object",
      properties: {
        firstName: { type: ["string", "null"] },
        lastName: { type: ["string", "null"] },
        email: { type: ["string", "null"] },
        company: { type: ["string", "null"] },
      },
      additionalProperties: false,
    },
  })
  .addModel("deal", {
    title: "Deal",
    schema: {
      type: "object",
      properties: {
        name: { type: ["string", "null"] },
        amount: { type: ["string", "null"] },
        stage: { type: ["string", "null"] },
      },
      additionalProperties: false,
    },
  })
  .deploy();

// Create custom app with default OAuth connector
const hubspotCustomApp = defineHubSpotCustomApp().deploy();

const hubspotRestConnector = createHubSpotRestConnector();

// Create sync connector with minimal models
// Note: Only contact will work out of the box since we provide that model connector
const hubspotSyncConnector = createHubSpotSyncConnector(
  hubspotRestConnector,
  minimalCrmCollection
).build();

// You could also use a standard CRM collection with selected models
const selectedModelsCollection = defineCrmCollection()
  .withOnlyModels("contact", "opportunity", "task")
  .deploy();

const hubspotSyncConnectorSelected = createHubSpotSyncConnector(
  hubspotRestConnector,
  selectedModelsCollection
).build();

defineIntegration("hubspot-minimal")
  .withTitle("HubSpot Minimal")
  .withCustomApp(hubspotCustomApp)
  .withActions(
    defineAction("sync-contacts-only")
      .withRun(async () => {
        // This will sync only contacts from our minimal collection
        await hubspotSyncConnector.sync();
      })
      .deploy()
  )
  .deploy();
