import { describe, it, expect, beforeEach } from "vitest";
import { defineIntegration } from "./integration";
import {
  defineOAuth2CustomApp,
  defineCollection,
  defineModel,
  defineAction,
} from "./";
import { clearRegistry, getIntegrations } from "../registry";

describe("IntegrationBuilder", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("Basic integration creation", () => {
    it("should create a basic integration with built-in app", () => {
      const collection = defineCollection("crm").deploy();

      const integration = defineIntegration("salesforce-sync")
        .withTitle("Salesforce Sync Integration")
        .withApp("salesforce")
        .withCollection(collection)
        .deploy();

      expect(integration.name).toBe("salesforce-sync");
      expect(integration.title).toBe("Salesforce Sync Integration");
      expect(integration.app.type).toBe("builtin");
      expect(integration.app.name).toBe("salesforce");
      expect(integration.app.definition).toBeUndefined();
      expect(integration.collection).toEqual(collection);
      expect(integration.actions).toEqual({});
    });

    it("should create an integration with custom app", () => {
      const customApp = defineOAuth2CustomApp("github")
        .withTitle("GitHub OAuth")
        .addSecret("client_id")
        .addSecret("client_secret")
        .deploy();

      const collection = defineCollection("repositories").deploy();

      const integration = defineIntegration("github-sync")
        .withTitle("GitHub Integration")
        .withCustomApp(customApp)
        .withCollection(collection)
        .deploy();

      expect(integration.name).toBe("github-sync");
      expect(integration.title).toBe("GitHub Integration");
      expect(integration.app.type).toBe("custom");
      expect(integration.app.name).toBe("github");
      expect(integration.app.definition).toEqual(customApp);
      expect(integration.collection).toEqual(collection);
    });

    it("should create an integration without title", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("simple-integration")
        .withApp("hubspot")
        .withCollection(collection)
        .deploy();

      expect(integration.name).toBe("simple-integration");
      expect(integration.title).toBeUndefined();
      expect(integration.app.type).toBe("builtin");
      expect(integration.app.name).toBe("hubspot");
      expect(integration.collection).toEqual(collection);
    });
  });

  describe("Collections", () => {
    it("should add collection to integration", () => {
      const tmp = defineCollection("tmp-models");
      const contact = defineModel(tmp, "contact").withTitle("Contact").deploy();

      const crm = defineCollection("crm")
        .withTitle("CRM Collection")
        .withModel(contact)
        .deploy();

      const integration = defineIntegration("crm-sync")
        .withApp("salesforce")
        .withCollection(crm)
        .deploy();

      expect(integration.collection).toEqual(crm);
      expect(integration.collection.name).toBe("crm");
    });

    it("should allow changing collection", () => {
      const tmp = defineCollection("tmp-models");
      const contact = defineModel(tmp, "contact").deploy();
      const account = defineModel(tmp, "account").deploy();

      const crm = defineCollection("crm").withModel(contact).deploy();
      const sales = defineCollection("sales").withModel(account).deploy();

      const integration = defineIntegration("collection-change")
        .withApp("salesforce")
        .withCollection(crm)
        .withCollection(sales) // Replaces previous collection
        .deploy();

      expect(integration.collection).toEqual(sales);
      expect(integration.collection.name).toBe("sales");
    });
  });

  describe("Actions", () => {
    it("should add actions to integration", () => {
      const collection = defineCollection("contacts").deploy();
      const syncAction = defineAction("sync-contacts")
        .withTitle("Sync Contacts")
        .withDescription("Synchronize contact data")
        .addVariable("batch_size", { defaultValue: "100" })
        .deploy();

      const integration = defineIntegration("contact-sync")
        .withApp("salesforce")
        .withCollection(collection)
        .withAction(syncAction)
        .deploy();

      expect(integration.actions).toHaveProperty("sync-contacts");
      expect(integration.actions["sync-contacts"]).toEqual(syncAction);
    });

    it("should add multiple actions at once", () => {
      const collection = defineCollection("data").deploy();
      const syncAction = defineAction("sync-contacts")
        .withTitle("Sync Contacts")
        .deploy();

      const exportAction = defineAction("export-data")
        .withTitle("Export Data")
        .deploy();

      const integration = defineIntegration("multi-action-sync")
        .withApp("salesforce")
        .withCollection(collection)
        .withActions([syncAction, exportAction])
        .deploy();

      expect(integration.actions).toHaveProperty("sync-contacts");
      expect(integration.actions).toHaveProperty("export-data");
      expect(Object.keys(integration.actions)).toHaveLength(2);
    });

    it("should support adding actions incrementally", () => {
      const collection = defineCollection("tasks").deploy();
      const syncAction = defineAction("sync").deploy();
      const importAction = defineAction("import").deploy();
      const exportAction = defineAction("export").deploy();

      const integration = defineIntegration("incremental-actions")
        .withApp("salesforce")
        .withCollection(collection)
        .addAction(syncAction)
        .addAction(importAction)
        .addActions([exportAction])
        .deploy();

      expect(Object.keys(integration.actions)).toHaveLength(3);
      expect(integration.actions.sync).toEqual(syncAction);
      expect(integration.actions.import).toEqual(importAction);
      expect(integration.actions.export).toEqual(exportAction);
    });

    it("should work with both collection and actions", () => {
      const tmp = defineCollection("tmp-models");
      const contact = defineModel(tmp, "contact").deploy();
      const crm = defineCollection("crm").withModel(contact).deploy();
      const syncAction = defineAction("sync").deploy();

      const integration = defineIntegration("complete-integration")
        .withApp("salesforce")
        .withCollection(crm)
        .withAction(syncAction)
        .deploy();

      expect(integration.collection).toEqual(crm);
      expect(Object.keys(integration.actions)).toHaveLength(1);
      expect(integration.actions.sync).toEqual(syncAction);
    });
  });

  describe("Error handling", () => {
    it("should throw error when no app is specified", () => {
      const collection = defineCollection("crm").deploy();

      expect(() => {
        defineIntegration("no-app-integration")
          .withTitle("Integration without app")
          .withCollection(collection)
          .deploy();
      }).toThrow(
        'Integration "no-app-integration" requires an app. Use .withApp() for built-in apps or .withCustomApp() for custom apps.'
      );
    });

    it("should throw error when no collection is specified", () => {
      expect(() => {
        defineIntegration("no-collection-integration")
          .withTitle("Integration without collection")
          .withApp("salesforce")
          .deploy();
      }).toThrow(
        'Integration "no-collection-integration" requires a collection. Use .withCollection() to specify one.'
      );
    });

    it("should throw error when neither app nor collection specified", () => {
      expect(() => {
        defineIntegration("incomplete-integration")
          .withTitle("Incomplete integration")
          .deploy();
      }).toThrow(
        'Integration "incomplete-integration" requires an app. Use .withApp() for built-in apps or .withCustomApp() for custom apps.'
      );
    });
  });

  describe("Registry integration", () => {
    it("should automatically register integrations when deployed", () => {
      expect(getIntegrations()).toHaveLength(0);

      const collection = defineCollection("crm").deploy();
      const integration = defineIntegration("registry-test")
        .withTitle("Registry Test Integration")
        .withApp("salesforce")
        .withCollection(collection)
        .deploy();

      const integrations = getIntegrations();
      expect(integrations).toHaveLength(1);
      expect(integrations[0].name).toBe("registry-test");
      expect(integrations[0].integration).toEqual(integration);
      expect(integrations[0].type).toBe("integration");
      expect(integrations[0].metadata?.builderType).toBe("IntegrationBuilder");
      expect(integrations[0].metadata?.createdBy).toBe("defineIntegration");
      expect(integrations[0].metadata?.appType).toBe("builtin");
      expect(integrations[0].metadata?.collectionName).toBe("crm");
      expect(integrations[0].metadata?.actionCount).toBe(0);
    });

    it("should track metadata correctly", () => {
      const customApp = defineOAuth2CustomApp("custom").deploy();
      const crm = defineCollection("crm").deploy();
      const syncAction = defineAction("sync").deploy();
      const exportAction = defineAction("export").deploy();

      defineIntegration("metadata-test")
        .withCustomApp(customApp)
        .withCollection(crm)
        .addAction(syncAction)
        .addAction(exportAction)
        .deploy();

      const integrations = getIntegrations();
      expect(integrations[0].metadata?.appType).toBe("custom");
      expect(integrations[0].metadata?.collectionName).toBe("crm");
      expect(integrations[0].metadata?.actionCount).toBe(2);
    });

    it("should generate unique IDs for integrations", () => {
      const collection1 = defineCollection("crm1").deploy();
      const collection2 = defineCollection("crm2").deploy();

      defineIntegration("integration1")
        .withApp("salesforce")
        .withCollection(collection1)
        .deploy();
      defineIntegration("integration1")
        .withApp("hubspot")
        .withCollection(collection2)
        .deploy(); // Same name, different instance

      const integrations = getIntegrations();
      expect(integrations).toHaveLength(2);
      expect(integrations[0].id).not.toBe(integrations[1].id);
    });
  });

  describe("Method chaining", () => {
    it("should support fluent API method chaining", () => {
      const customApp = defineOAuth2CustomApp("comprehensive")
        .withTitle("Comprehensive OAuth App")
        .addSecret("client_id")
        .addSecret("client_secret")
        .deploy();

      const crm = defineCollection("crm")
        .addModel("contact")
        .addModel("account")
        .deploy();

      const integration = defineIntegration("comprehensive-integration")
        .withTitle("Comprehensive Integration")
        .withCustomApp(customApp)
        .withCollection(crm)
        .deploy();

      expect(integration.name).toBe("comprehensive-integration");
      expect(integration.title).toBe("Comprehensive Integration");
      expect(integration.app.type).toBe("custom");
      expect(integration.app.name).toBe("comprehensive");
      expect(integration.collection).toEqual(crm);
      expect(integration.collection.name).toBe("crm");
    });
  });

  describe("Sync schedules", () => {
    it("should add sync schedules to integration", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("scheduled-sync")
        .withApp("salesforce")
        .withCollection(collection)
        .withSyncSchedules([
          { type: "INCREMENTAL", every: "5 minutes" },
          { type: "FULL", every: "1 day" },
        ])
        .deploy();

      expect(integration.syncSchedules).toHaveLength(2);
      expect(integration.syncSchedules?.[0]).toEqual({
        type: "INCREMENTAL",
        every: "5 minutes",
      });
      expect(integration.syncSchedules?.[1]).toEqual({
        type: "FULL",
        every: "1 day",
      });
    });

    it("should add sync schedules incrementally", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("incremental-schedules")
        .withApp("salesforce")
        .withCollection(collection)
        .addSyncSchedule({ type: "INCREMENTAL", every: 300 })
        .addSyncSchedule({ type: "FULL", every: "1 day" })
        .deploy();

      expect(integration.syncSchedules).toHaveLength(2);
      expect(integration.syncSchedules?.[0].type).toBe("INCREMENTAL");
      expect(integration.syncSchedules?.[0].every).toBe(300);
      expect(integration.syncSchedules?.[1].type).toBe("FULL");
      expect(integration.syncSchedules?.[1].every).toBe("1 day");
    });

    it("should add multiple sync schedules at once", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("batch-schedules")
        .withApp("salesforce")
        .withCollection(collection)
        .addSyncSchedules([
          { type: "INCREMENTAL", every: "15 minutes" },
          { type: "FULL", every: "1 week" },
        ])
        .deploy();

      expect(integration.syncSchedules).toHaveLength(2);
      expect(integration.syncSchedules?.[0].type).toBe("INCREMENTAL");
      expect(integration.syncSchedules?.[1].type).toBe("FULL");
    });

    it("should support sync schedules without every field", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("no-every-schedule")
        .withApp("salesforce")
        .withCollection(collection)
        .addSyncSchedule({ type: "INCREMENTAL" })
        .deploy();

      expect(integration.syncSchedules).toHaveLength(1);
      expect(integration.syncSchedules?.[0].type).toBe("INCREMENTAL");
      expect(integration.syncSchedules?.[0].every).toBeUndefined();
    });

    it("should replace sync schedules when using withSyncSchedules", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("replace-schedules")
        .withApp("salesforce")
        .withCollection(collection)
        .addSyncSchedule({ type: "INCREMENTAL", every: "5 minutes" })
        .withSyncSchedules([{ type: "FULL", every: "1 day" }])
        .deploy();

      expect(integration.syncSchedules).toHaveLength(1);
      expect(integration.syncSchedules?.[0].type).toBe("FULL");
    });

    it("should support both number and string for every field", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("mixed-every-types")
        .withApp("salesforce")
        .withCollection(collection)
        .addSyncSchedule({ type: "INCREMENTAL", every: 300 })
        .addSyncSchedule({ type: "FULL", every: "1 day" })
        .deploy();

      expect(integration.syncSchedules?.[0].every).toBe(300);
      expect(typeof integration.syncSchedules?.[0].every).toBe("number");
      expect(integration.syncSchedules?.[1].every).toBe("1 day");
      expect(typeof integration.syncSchedules?.[1].every).toBe("string");
    });

    it("should work with actions and sync schedules together", () => {
      const collection = defineCollection("contacts").deploy();
      const syncAction = defineAction("sync-contacts").deploy();

      const integration = defineIntegration("complete-with-schedules")
        .withApp("salesforce")
        .withCollection(collection)
        .withAction(syncAction)
        .addSyncSchedule({ type: "INCREMENTAL", every: "10 minutes" })
        .deploy();

      expect(integration.actions).toHaveProperty("sync-contacts");
      expect(integration.syncSchedules).toHaveLength(1);
      expect(integration.syncSchedules?.[0].type).toBe("INCREMENTAL");
    });

    it("should allow integration without sync schedules", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("no-schedules")
        .withApp("salesforce")
        .withCollection(collection)
        .deploy();

      expect(integration.syncSchedules).toBeUndefined();
    });

    it("should support object-based sync schedule configuration", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("object-schedules")
        .withApp("salesforce")
        .withCollection(collection)
        .withSyncSchedules({
          incremental: { every: "15 minutes" },
          full: { every: "3 days" },
        })
        .deploy();

      expect(integration.syncSchedules).toHaveLength(2);
      expect(integration.syncSchedules?.[0]).toEqual({
        type: "INCREMENTAL",
        every: "15 minutes",
      });
      expect(integration.syncSchedules?.[1]).toEqual({
        type: "FULL",
        every: "3 days",
      });
    });

    it("should support object-based configuration with only incremental", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("incremental-only-object")
        .withApp("salesforce")
        .withCollection(collection)
        .withSyncSchedules({
          incremental: { every: "5 minutes" },
        })
        .deploy();

      expect(integration.syncSchedules).toHaveLength(1);
      expect(integration.syncSchedules?.[0]).toEqual({
        type: "INCREMENTAL",
        every: "5 minutes",
      });
    });

    it("should support object-based configuration with only full", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("full-only-object")
        .withApp("salesforce")
        .withCollection(collection)
        .withSyncSchedules({
          full: { every: "1 day" },
        })
        .deploy();

      expect(integration.syncSchedules).toHaveLength(1);
      expect(integration.syncSchedules?.[0]).toEqual({
        type: "FULL",
        every: "1 day",
      });
    });

    it("should support object-based configuration without every field", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("no-every-object")
        .withApp("salesforce")
        .withCollection(collection)
        .withSyncSchedules({
          incremental: {},
          full: {},
        })
        .deploy();

      expect(integration.syncSchedules).toHaveLength(2);
      expect(integration.syncSchedules?.[0].type).toBe("INCREMENTAL");
      expect(integration.syncSchedules?.[0].every).toBeUndefined();
      expect(integration.syncSchedules?.[1].type).toBe("FULL");
      expect(integration.syncSchedules?.[1].every).toBeUndefined();
    });

    it("should support object-based configuration with numeric intervals", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("numeric-object")
        .withApp("salesforce")
        .withCollection(collection)
        .withSyncSchedules({
          incremental: { every: 900 }, // 15 minutes in seconds
          full: { every: 259200 }, // 3 days in seconds
        })
        .deploy();

      expect(integration.syncSchedules).toHaveLength(2);
      expect(integration.syncSchedules?.[0].every).toBe(900);
      expect(integration.syncSchedules?.[1].every).toBe(259200);
    });

    it("should clear schedules when empty object is passed", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("clear-schedules")
        .withApp("salesforce")
        .withCollection(collection)
        .addSyncSchedule({ type: "INCREMENTAL", every: "5 minutes" })
        .withSyncSchedules({})
        .deploy();

      expect(integration.syncSchedules).toBeUndefined();
    });

    it("should support BASELINE sync schedule type with maxRetries", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("baseline-schedule")
        .withApp("salesforce")
        .withCollection(collection)
        .addSyncSchedule({ type: "BASELINE", maxRetries: 3 })
        .deploy();

      expect(integration.syncSchedules).toHaveLength(1);
      expect(integration.syncSchedules?.[0].type).toBe("BASELINE");
      expect(integration.syncSchedules?.[0].maxRetries).toBe(3);
      expect(integration.syncSchedules?.[0].every).toBeUndefined();
    });

    it("should support all three sync schedule types together", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("all-schedule-types")
        .withApp("salesforce")
        .withCollection(collection)
        .withSyncSchedules([
          { type: "INCREMENTAL", every: "5 minutes" },
          { type: "FULL", every: "1 day" },
          { type: "BASELINE", maxRetries: 5 },
        ])
        .deploy();

      expect(integration.syncSchedules).toHaveLength(3);
      expect(integration.syncSchedules?.[0].type).toBe("INCREMENTAL");
      expect(integration.syncSchedules?.[1].type).toBe("FULL");
      expect(integration.syncSchedules?.[2].type).toBe("BASELINE");
      expect(integration.syncSchedules?.[2].maxRetries).toBe(5);
    });

    it("should support object-based configuration with baseline", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("object-with-baseline")
        .withApp("salesforce")
        .withCollection(collection)
        .withSyncSchedules({
          incremental: { every: "5 minutes" },
          full: { every: "1 day" },
          baseline: { maxRetries: 3 },
        })
        .deploy();

      expect(integration.syncSchedules).toHaveLength(3);
      expect(integration.syncSchedules?.[0].type).toBe("INCREMENTAL");
      expect(integration.syncSchedules?.[1].type).toBe("FULL");
      expect(integration.syncSchedules?.[2].type).toBe("BASELINE");
      expect(integration.syncSchedules?.[2].maxRetries).toBe(3);
      expect(integration.syncSchedules?.[2].every).toBeUndefined();
    });

    it("should support baseline-only object-based configuration", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("baseline-only-object")
        .withApp("salesforce")
        .withCollection(collection)
        .withSyncSchedules({
          baseline: { maxRetries: 5 },
        })
        .deploy();

      expect(integration.syncSchedules).toHaveLength(1);
      expect(integration.syncSchedules?.[0].type).toBe("BASELINE");
      expect(integration.syncSchedules?.[0].maxRetries).toBe(5);
    });

    it("should clear schedules when empty object is passed (no prior schedules)", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("no-schedules-empty-object")
        .withApp("salesforce")
        .withCollection(collection)
        .withSyncSchedules({})
        .deploy();

      expect(integration.syncSchedules).toBeUndefined();
    });
  });

  describe("Read-only and write-only configuration", () => {
    it("should mark integration as read-only", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("read-only-integration")
        .withApp("hubspot")
        .withCollection(collection)
        .asReadOnly()
        .deploy();

      expect(integration.readOnly).toBe(true);
      expect(integration.writeOnly).toBeUndefined();
      expect(integration.modelPermissions).toBeUndefined();
    });

    it("should mark integration as write-only", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("write-only-integration")
        .withApp("hubspot")
        .withCollection(collection)
        .asWriteOnly()
        .deploy();

      expect(integration.writeOnly).toBe(true);
      expect(integration.readOnly).toBeUndefined();
      expect(integration.modelPermissions).toBeUndefined();
    });

    it("should mark specific models as read-only", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("mixed-permissions")
        .withApp("hubspot")
        .withCollection(collection)
        .withReadOnlyModels(["owner", "user"])
        .deploy();

      expect(integration.readOnly).toBeUndefined();
      expect(integration.writeOnly).toBeUndefined();
      expect(integration.modelPermissions).toEqual([
        { model: "owner", readOnly: true },
        { model: "user", readOnly: true },
      ]);
    });

    it("should mark specific models as write-only", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("write-only-models")
        .withApp("hubspot")
        .withCollection(collection)
        .withWriteOnlyModels(["event", "webhook"])
        .deploy();

      expect(integration.readOnly).toBeUndefined();
      expect(integration.writeOnly).toBeUndefined();
      expect(integration.modelPermissions).toEqual([
        { model: "event", writeOnly: true },
        { model: "webhook", writeOnly: true },
      ]);
    });

    it("should use modelPermissions directly", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("direct-permissions")
        .withApp("hubspot")
        .withCollection(collection)
        .withModelPermissions([
          { model: "owner", readOnly: true },
          { model: "contact", readOnly: false },
          { model: "event", writeOnly: true },
        ])
        .deploy();

      expect(integration.modelPermissions).toEqual([
        { model: "owner", readOnly: true },
        { model: "contact", readOnly: false },
        { model: "event", writeOnly: true },
      ]);
    });

    it("should throw error when integration is both read-only and write-only", () => {
      const collection = defineCollection("contacts").deploy();

      expect(() => {
        defineIntegration("conflicting-integration")
          .withApp("hubspot")
          .withCollection(collection)
          .asReadOnly()
          .asWriteOnly()
          .deploy();
      }).toThrow(
        'Integration "conflicting-integration" cannot be both read-only and write-only'
      );
    });

    it("should throw error when model is both read-only and write-only", () => {
      const collection = defineCollection("contacts").deploy();

      expect(() => {
        defineIntegration("conflicting-model")
          .withApp("hubspot")
          .withCollection(collection)
          .withModelPermissions([
            { model: "owner", readOnly: true, writeOnly: true },
          ])
          .deploy();
      }).toThrow(
        'Integration "conflicting-model" model "owner" cannot be both read-only and write-only'
      );
    });

    it("should throw error when integration is read-only but model is write-only", () => {
      const collection = defineCollection("contacts").deploy();

      expect(() => {
        defineIntegration("read-only-with-write-model")
          .withApp("hubspot")
          .withCollection(collection)
          .asReadOnly()
          .withModelPermissions([{ model: "event", writeOnly: true }])
          .deploy();
      }).toThrow(
        'Integration "read-only-with-write-model" is read-only but model "event" is marked as write-only'
      );
    });

    it("should throw error when integration is write-only but model is read-only", () => {
      const collection = defineCollection("contacts").deploy();

      expect(() => {
        defineIntegration("write-only-with-read-model")
          .withApp("hubspot")
          .withCollection(collection)
          .asWriteOnly()
          .withModelPermissions([{ model: "owner", readOnly: true }])
          .deploy();
      }).toThrow(
        'Integration "write-only-with-read-model" is write-only but model "owner" is marked as read-only'
      );
    });

    it("should throw error for duplicate models in modelPermissions", () => {
      const collection = defineCollection("contacts").deploy();

      expect(() => {
        defineIntegration("duplicate-models")
          .withApp("hubspot")
          .withCollection(collection)
          .withModelPermissions([
            { model: "owner", readOnly: true },
            { model: "owner", writeOnly: true },
          ])
          .deploy();
      }).toThrow(
        'Integration "duplicate-models" has duplicate model "owner" in modelPermissions'
      );
    });

    it("should update model permissions when withReadOnlyModels is called multiple times", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("update-permissions")
        .withApp("hubspot")
        .withCollection(collection)
        .withReadOnlyModels(["owner"])
        .withReadOnlyModels(["owner", "user"])
        .deploy();

      expect(integration.modelPermissions).toEqual([
        { model: "owner", readOnly: true },
        { model: "user", readOnly: true },
      ]);
    });

    it("should copy read-only/write-only fields in IntegrationBuilder.from()", () => {
      const collection = defineCollection("contacts").deploy();

      const original = defineIntegration("original")
        .withApp("hubspot")
        .withCollection(collection)
        .asReadOnly()
        .withReadOnlyModels(["owner"])
        .deploy();

      const copied = defineIntegration
        .from(original)
        .withApp("hubspot")
        .withCollection(collection)
        .deploy();

      expect(copied.readOnly).toBe(true);
      expect(copied.modelPermissions).toEqual([
        { model: "owner", readOnly: true },
      ]);
    });

    it("should support chaining read-only methods", () => {
      const collection = defineCollection("contacts").deploy();

      const integration = defineIntegration("chained-methods")
        .withApp("hubspot")
        .withCollection(collection)
        .asReadOnly()
        .withReadOnlyModels(["owner", "user"])
        .deploy();

      expect(integration.readOnly).toBe(true);
      expect(integration.modelPermissions).toEqual([
        { model: "owner", readOnly: true },
        { model: "user", readOnly: true },
      ]);
    });
  });
});
