import { beforeEach, describe, expect, it } from "vitest";

import { clearRegistry, getWebhooks } from "../registry";
import { defineOAuth2CustomApp } from "./customApp";
import { defineWebhook } from "./webhook";

describe("WebhookBuilder", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("should create a basic webhook", () => {
    const webhook = defineWebhook("demo-request")
      .withTitle("Demo Request")
      .deploy();

    expect(webhook.name).toBe("demo-request");
    expect(webhook.title).toBe("Demo Request");
    expect(webhook.apps).toBeUndefined();
    expect(webhook.customApps).toBeUndefined();
    expect(webhook.variables).toBeUndefined();
    expect(webhook.secrets).toBeUndefined();
  });

  it("should support apps, custom apps, variables, and secrets", () => {
    const customApp = defineOAuth2CustomApp("internal-api").deploy();

    const webhook = defineWebhook("qualified-lead")
      .withTitle("Qualified Lead")
      .withApp("hubspot")
      .addApps(["slack", "salesforce"])
      .withCustomApp(customApp)
      .addCustomApp("partner-api")
      .addVariable("lead_source", {
        title: "Lead Source",
        description: "Inbound lead source",
        required: true,
      })
      .addSecret("signing_secret", {
        title: "Signing Secret",
        required: true,
      })
      .deploy();

    expect(webhook.apps).toEqual(["hubspot", "slack", "salesforce"]);
    expect(webhook.customApps).toEqual(["internal-api", "partner-api"]);
    expect(webhook.variables).toEqual([
      {
        name: "lead_source",
        title: "Lead Source",
        description: "Inbound lead source",
        required: true,
      },
    ]);
    expect(webhook.secrets).toEqual([
      {
        name: "signing_secret",
        title: "Signing Secret",
        required: true,
      },
    ]);
  });

  it("should automatically register webhooks when deployed", () => {
    expect(getWebhooks()).toHaveLength(0);

    const webhook = defineWebhook("registry-test")
      .withTitle("Registry Test")
      .addVariable("tenant")
      .deploy();

    const webhooks = getWebhooks();
    expect(webhooks).toHaveLength(1);
    expect(webhooks[0].name).toBe("registry-test");
    expect(webhooks[0].webhook).toEqual(webhook);
    expect(webhooks[0].type).toBe("webhook");
    expect(webhooks[0].metadata?.builderType).toBe("WebhookBuilder");
    expect(webhooks[0].metadata?.createdBy).toBe("defineWebhook");
    expect(webhooks[0].metadata?.variableCount).toBe(1);
  });

  it("should support copying from an existing webhook", () => {
    const original = defineWebhook("original")
      .withTitle("Original Webhook")
      .withApps(["hubspot", "slack"])
      .addSecret("token")
      .deploy();

    const copy = defineWebhook
      .from(original)
      .withName("copy")
      .withTitle("Copy Webhook")
      .deploy();

    expect(copy.name).toBe("copy");
    expect(copy.title).toBe("Copy Webhook");
    expect(copy.apps).toEqual(["hubspot", "slack"]);
    expect(copy.secrets).toEqual([{ name: "token", required: false }]);
  });
});
