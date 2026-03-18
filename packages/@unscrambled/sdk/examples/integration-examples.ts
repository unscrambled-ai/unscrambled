/**
 * Integration Examples
 *
 * Various examples showing how to define integrations with apps, collections, and actions
 */

import {
  defineIntegration,
  defineCollection,
  defineAction,
  defineApiKeyCustomApp,
} from "../src";

/**
 * Define an integration with a name
 * NOTE: This will throw an error because app and collection are required
 */

// const simpleIntegration = defineIntegration("data-sync").deploy();

/**
 * Define an integration with a name, title, app, and collection
 */

const customerCollection = defineCollection("customers")
  .addModel("customer")
  .deploy();

const titledIntegration = defineIntegration("customer-sync")
  .withTitle("Customer Data Synchronization")
  .withApp("salesforce")
  .withCollection(customerCollection)
  .deploy();

/**
 * Define an integration with a name, title, app, and collection
 */

const repoCollection = defineCollection("repositories")
  .addModel("repository")
  .deploy();

const builtinAppIntegration = defineIntegration("github-integration")
  .withTitle("GitHub Repository Manager")
  .withApp("github") // Using a built-in app
  .withCollection(repoCollection)
  .deploy();

/**
 * Define an integration with a name, title, custom app, and collection
 */

// First, define a custom app
const customCRMApp = defineApiKeyCustomApp("custom-crm")
  .withTitle("Custom CRM System")
  .addVariable("api_endpoint", {
    title: "API Endpoint",
    description: "Base URL for the CRM API",
    required: true,
  })
  .deploy();

const crmCollection = defineCollection("crm-data")
  .addModel("account")
  .addModel("contact")
  .deploy();

const customAppIntegration = defineIntegration("crm-integration")
  .withTitle("Custom CRM Integration")
  .withCustomApp(customCRMApp)
  .withCollection(crmCollection)
  .deploy();

/**
 * Define an integration with a name, title, custom app, collection, and actions
 */

// Define an action for the integration
const syncContactsAction = defineAction("sync-contacts")
  .withTitle("Sync Contacts")
  .withDescription("Synchronizes contacts between systems")
  .addVariable("sync_direction", {
    title: "Sync Direction",
    description: "Direction of synchronization",
    defaultValue: "bidirectional",
    required: true,
  })
  .withRun(async ({ variables, auths }) => {
    console.log(`Syncing contacts: ${variables.sync_direction}`);
    // Sync logic here
    return;
  })
  .deploy();

const contactCollection = defineCollection("contacts")
  .addModel("contact")
  .deploy();

const actionIntegration = defineIntegration("contact-manager")
  .withTitle("Contact Management System")
  .withCustomApp(customCRMApp)
  .withCollection(contactCollection)
  .withAction(syncContactsAction)
  .deploy();

/**
 * Define a duplicate integration from an instantiated integration
 */

const duplicateIntegration = defineIntegration
  .from(actionIntegration)
  .withTitle("Contact Management System v2")
  .deploy();

/**
 * Define an integration with sync schedules
 */

const scheduledCollection = defineCollection("scheduled-data")
  .addModel("product")
  .addModel("order")
  .deploy();

const scheduledIntegration = defineIntegration("scheduled-sync")
  .withTitle("Scheduled Data Sync")
  .withApp("salesforce")
  .withCollection(scheduledCollection)
  .withSyncSchedules([
    { type: "INCREMENTAL", every: "5 minutes" },
    { type: "FULL", every: "1 day" },
    { type: "BASELINE", maxRetries: 3 },
  ])
  .deploy();

/**
 * Define an integration with sync schedules added incrementally
 */

const incrementalScheduleCollection = defineCollection("incremental-data")
  .addModel("lead")
  .deploy();

const incrementalScheduleIntegration = defineIntegration(
  "incremental-schedule-sync"
)
  .withTitle("Incremental Schedule Sync")
  .withApp("hubspot")
  .withCollection(incrementalScheduleCollection)
  .addSyncSchedule({ type: "INCREMENTAL", every: 300 }) // Every 5 minutes (in seconds)
  .addSyncSchedule({ type: "FULL", every: "1 week" })
  .addSyncSchedule({ type: "BASELINE", maxRetries: 5 })
  .deploy();

/**
 * Define an integration with sync schedules using numeric intervals
 */

const numericScheduleCollection = defineCollection("numeric-schedule-data")
  .addModel("task")
  .deploy();

const numericScheduleIntegration = defineIntegration("numeric-schedule-sync")
  .withTitle("Numeric Schedule Sync")
  .withApp("salesforce")
  .withCollection(numericScheduleCollection)
  .addSyncSchedules([
    { type: "INCREMENTAL", every: 600 }, // Every 10 minutes (in seconds)
    { type: "FULL", every: 86400 }, // Every 24 hours (in seconds)
  ])
  .deploy();

/**
 * Define an integration with both actions and sync schedules
 */

const fullFeaturedCollection = defineCollection("full-featured-data")
  .addModel("opportunity")
  .deploy();

const fullFeaturedAction = defineAction("manual-sync")
  .withTitle("Manual Sync Trigger")
  .withRun(async () => {
    console.log("Manual sync triggered");
  })
  .deploy();

const fullFeaturedIntegration = defineIntegration("full-featured-integration")
  .withTitle("Full Featured Integration")
  .withCustomApp(customCRMApp)
  .withCollection(fullFeaturedCollection)
  .withAction(fullFeaturedAction)
  .addSyncSchedule({ type: "INCREMENTAL", every: "15 minutes" })
  .addSyncSchedule({ type: "FULL", every: "1 day" })
  .deploy();

/**
 * Define an integration with object-based sync schedule configuration
 */

const objectScheduleCollection = defineCollection("object-schedule-data")
  .addModel("invoice")
  .deploy();

const objectScheduleIntegration = defineIntegration("object-schedule-sync")
  .withTitle("Object Schedule Sync")
  .withApp("salesforce")
  .withCollection(objectScheduleCollection)
  .withSyncSchedules({
    incremental: { every: "15 minutes" },
    full: { every: "3 days" },
    baseline: { maxRetries: 3 },
  })
  .deploy();

// Export examples for reference
export {
  titledIntegration,
  builtinAppIntegration,
  customAppIntegration,
  actionIntegration,
  duplicateIntegration,
  scheduledIntegration,
  incrementalScheduleIntegration,
  numericScheduleIntegration,
  fullFeaturedIntegration,
  objectScheduleIntegration,
};
