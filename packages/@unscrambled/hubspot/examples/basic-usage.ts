import {
  defineCrmCollection,
  defineAction,
  defineIntegration,
} from "@unscrambled/sdk";
import {
  defineHubSpotCustomApp,
  createHubSpotRestConnector,
  createHubSpotSyncConnector,
} from "../src";

// 1. Define a custom app using the HubSpot helper (includes OAuth connector)
const hubspotCustomApp = defineHubSpotCustomApp().deploy();

// 2. Create the REST connector
const hubspotRestConnector = createHubSpotRestConnector();

// 3. Define a CRM collection with the models you need
const crmCollection = defineCrmCollection()
  .withOnlyModels("user", "account", "contact", "opportunity")
  .deploy();

// 4. Create the sync connector
const hubspotSyncConnector = createHubSpotSyncConnector(
  hubspotRestConnector,
  crmCollection
).build();

// 5. Define your integration
defineIntegration("hubspot-crm")
  .withTitle("HubSpot CRM")
  .withCustomApp(hubspotCustomApp)
  .withActions(
    defineAction("hubspot-full-sync")
      .withRun(async () => {
        await hubspotSyncConnector.sync();
      })
      .deploy()
  )
  .deploy();
