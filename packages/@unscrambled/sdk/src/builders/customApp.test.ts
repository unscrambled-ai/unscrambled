import { describe, it, expect, beforeEach } from "vitest";
import {
  defineCustomApp,
  defineOAuth2CustomApp,
  defineApiKeyCustomApp,
  defineBasicCustomApp,
} from "./customApp";
import { clearRegistry, getCustomApps } from "../registry";

describe("CustomAppBuilder", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("Basic custom app creation", () => {
    it("should create a basic OAuth2 custom app", () => {
      const app = defineOAuth2CustomApp("github")
        .withTitle("GitHub Integration")
        .deploy();

      expect(app.name).toBe("github");
      expect(app.type).toBe("OAUTH2");
      expect(app.title).toBe("GitHub Integration");
      expect(app.variables).toBeUndefined();
      expect(app.secrets).toBeUndefined();
    });

    it("should create a basic API Key custom app", () => {
      const app = defineApiKeyCustomApp("stripe")
        .withTitle("Stripe Payments")
        .deploy();

      expect(app.name).toBe("stripe");
      expect(app.type).toBe("APIKEY");
      expect(app.title).toBe("Stripe Payments");
    });

    it("should create a basic auth custom app", () => {
      const app = defineBasicCustomApp("legacy-system").deploy();

      expect(app.name).toBe("legacy-system");
      expect(app.type).toBe("BASIC");
      expect(app.title).toBeUndefined();
    });

    it("should create custom app using generic defineCustomApp function", () => {
      const app = defineCustomApp("custom", "OAUTH2")
        .withTitle("Custom OAuth App")
        .deploy();

      expect(app.name).toBe("custom");
      expect(app.type).toBe("OAUTH2");
      expect(app.title).toBe("Custom OAuth App");
    });
  });

  describe("Variables and secrets", () => {
    it("should add variables to a custom app", () => {
      const app = defineApiKeyCustomApp("mailgun")
        .withTitle("Mailgun Email Service")
        .addVariable("domain", {
          title: "Email Domain",
          description: "Your Mailgun domain",
          required: true,
        })
        .addVariable("region", {
          title: "Region",
          description: "Mailgun region (US or EU)",
          defaultValue: "US",
          required: false,
        })
        .deploy();

      expect(app.variables).toHaveLength(2);
      expect(app.variables![0].name).toBe("domain");
      expect(app.variables![0].title).toBe("Email Domain");
      expect(app.variables![0].required).toBe(true);
      expect(app.variables![1].name).toBe("region");
      expect(app.variables![1].defaultValue).toBe("US");
      expect(app.variables![1].required).toBe(false);
    });

    it("should add secrets to a custom app", () => {
      const app = defineOAuth2CustomApp("slack")
        .withTitle("Slack Integration")
        .addSecret("client_id", {
          title: "Client ID",
          description: "OAuth2 Client ID from Slack",
          required: true,
        })
        .addSecret("client_secret", {
          title: "Client Secret",
          description: "OAuth2 Client Secret from Slack",
          required: true,
        })
        .deploy();

      expect(app.secrets).toHaveLength(2);
      expect(app.secrets![0].name).toBe("client_id");
      expect(app.secrets![0].required).toBe(true);
      expect(app.secrets![1].name).toBe("client_secret");
      expect(app.secrets![1].required).toBe(true);
    });

    it("should add multiple variables and secrets at once", () => {
      const variables = [
        { name: "host", title: "Database Host", required: true },
        {
          name: "port",
          title: "Database Port",
          defaultValue: "5432",
          required: false,
        },
      ];

      const secrets = [
        { name: "username", title: "Database Username", required: true },
        { name: "password", title: "Database Password", required: true },
      ];

      const app = defineBasicCustomApp("database")
        .withTitle("Database Connection")
        .addVariables(variables)
        .addSecrets(secrets)
        .deploy();

      expect(app.variables).toHaveLength(2);
      expect(app.secrets).toHaveLength(2);
    });

    it("should not include empty variables/secrets arrays", () => {
      const app = defineApiKeyCustomApp("simple")
        .withTitle("Simple App")
        .deploy();

      expect(app.variables).toBeUndefined();
      expect(app.secrets).toBeUndefined();
    });
  });

  describe("Registry integration", () => {
    it("should automatically register custom apps when built", () => {
      expect(getCustomApps()).toHaveLength(0);

      const app = defineOAuth2CustomApp("google")
        .withTitle("Google OAuth")
        .addSecret("client_id")
        .addSecret("client_secret")
        .deploy();

      const apps = getCustomApps();
      expect(apps).toHaveLength(1);
      expect(apps[0].name).toBe("google");
      expect(apps[0].customApp).toEqual(app);
      expect(apps[0].type).toBe("customApp");
      expect(apps[0].metadata?.builderType).toBe("CustomAppBuilder");
      expect(apps[0].metadata?.createdBy).toBe("defineCustomApp");
      expect(apps[0].metadata?.secretCount).toBe(2);
      expect(apps[0].metadata?.variableCount).toBe(0);
    });

    it("should track variable and secret counts in metadata", () => {
      defineApiKeyCustomApp("complex")
        .addVariable("var1")
        .addVariable("var2")
        .addVariable("var3")
        .addSecret("secret1")
        .addSecret("secret2")
        .deploy();

      const apps = getCustomApps();
      expect(apps[0].metadata?.variableCount).toBe(3);
      expect(apps[0].metadata?.secretCount).toBe(2);
    });

    it("should generate unique IDs for custom apps", () => {
      defineOAuth2CustomApp("app1").deploy();
      defineOAuth2CustomApp("app1").deploy(); // Same name, different instance

      const apps = getCustomApps();
      expect(apps).toHaveLength(2);
      expect(apps[0].id).not.toBe(apps[1].id);
    });
  });

  describe("Method chaining", () => {
    it("should support fluent API method chaining", () => {
      const app = defineOAuth2CustomApp("comprehensive")
        .withTitle("Comprehensive OAuth App")
        .addVariable("env", {
          title: "Environment",
          description: "Deployment environment",
          defaultValue: "production",
          required: true,
        })
        .addSecret("client_id", {
          title: "OAuth Client ID",
          required: true,
        })
        .addSecret("client_secret", {
          title: "OAuth Client Secret",
          required: true,
        })
        .addVariable("timeout", {
          title: "Request Timeout",
          defaultValue: "30000",
          required: false,
        })
        .deploy();

      expect(app.name).toBe("comprehensive");
      expect(app.type).toBe("OAUTH2");
      expect(app.title).toBe("Comprehensive OAuth App");
      expect(app.variables).toHaveLength(2);
      expect(app.secrets).toHaveLength(2);
    });
  });

  describe("asOwnApp", () => {
    it("should mark a custom app as own app", () => {
      const app = defineOAuth2CustomApp("my-company-api")
        .withTitle("My Company API")
        .asOwnApp()
        .deploy();

      expect(app.isOwnApp).toBe(true);
    });

    it("should set isOwnApp to false when not explicitly set", () => {
      const app = defineApiKeyCustomApp("third-party-api")
        .withTitle("Third Party API")
        .deploy();

      expect(app.isOwnApp).toBe(false);
    });

    it("should support method chaining with asOwnApp", () => {
      const app = defineOAuth2CustomApp("my-product")
        .withTitle("My Product")
        .asOwnApp()
        .addVariable("apiVersion", { required: true })
        .addSecret("apiKey", { required: true })
        .deploy();

      expect(app.isOwnApp).toBe(true);
      expect(app.variables).toHaveLength(1);
      expect(app.secrets).toHaveLength(1);
    });

    it("should preserve isOwnApp when using from()", () => {
      const originalApp = defineOAuth2CustomApp("original")
        .withTitle("Original App")
        .asOwnApp()
        .deploy();

      const clonedApp = defineCustomApp
        .from(originalApp)
        .withTitle("Cloned App")
        .deploy();

      expect(clonedApp.isOwnApp).toBe(true);
      expect(clonedApp.name).toBe("original");
      expect(clonedApp.title).toBe("Cloned App");
    });

    it("should work with all custom app types", () => {
      const oauthApp = defineOAuth2CustomApp("oauth-app").asOwnApp().deploy();

      const apiKeyApp = defineApiKeyCustomApp("apikey-app").asOwnApp().deploy();

      const basicApp = defineBasicCustomApp("basic-app").asOwnApp().deploy();

      expect(oauthApp.isOwnApp).toBe(true);
      expect(apiKeyApp.isOwnApp).toBe(true);
      expect(basicApp.isOwnApp).toBe(true);
    });
  });
});
