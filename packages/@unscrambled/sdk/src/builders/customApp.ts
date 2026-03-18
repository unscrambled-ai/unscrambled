import type {
  CustomApp,
  AppAuthType,
  AppVariable,
  AppSecret,
  OAuthConnectorClass,
  OAuthConnectorFactory,
} from "../types";
import { registerCustomApp } from "../registry";

/**
 * Custom App Builder - fluent API for creating custom apps
 */
export class CustomAppBuilder {
  private name: string;
  private type: AppAuthType;
  private title?: string;
  private variables: AppVariable[] = [];
  private secrets: AppSecret[] = [];
  private oauthConnector?: OAuthConnectorClass | OAuthConnectorFactory;
  private isOwnApp: boolean = false;

  constructor(name: string, type: AppAuthType) {
    this.name = name;
    this.type = type;
  }

  /**
   * Copy-constructor: create a builder from an existing custom app or builder
   */
  static from(source: CustomApp | CustomAppBuilder): CustomAppBuilder {
    const name =
      source instanceof CustomAppBuilder ? (source as any).name : source.name;
    const type =
      source instanceof CustomAppBuilder ? (source as any).type : source.type;
    const builder = new CustomAppBuilder(name, type);
    const title =
      source instanceof CustomAppBuilder ? (source as any).title : source.title;
    if (title) builder.withTitle(title);
    const variables =
      source instanceof CustomAppBuilder
        ? (source as any).variables
        : source.variables;
    if (variables && variables.length > 0)
      builder.addVariables(variables.map((v: AppVariable) => ({ ...v })));
    const secrets =
      source instanceof CustomAppBuilder
        ? (source as any).secrets
        : source.secrets;
    if (secrets && secrets.length > 0)
      builder.addSecrets(secrets.map((s: AppSecret) => ({ ...s })));
    const oauthConnector =
      source instanceof CustomAppBuilder
        ? (source as any).oauthConnector
        : source.oauthConnector;
    if (oauthConnector) builder.withOAuthConnector(oauthConnector);
    const isOwnApp =
      source instanceof CustomAppBuilder
        ? (source as any).isOwnApp
        : source.isOwnApp;
    if (isOwnApp) builder.asOwnApp();
    return builder;
  }

  withTitle(title: string): this {
    this.title = title;
    return this;
  }

  addVariable(
    name: string,
    options?: {
      title?: string;
      description?: string;
      defaultValue?: string;
      required?: boolean;
    }
  ): this {
    this.variables.push({
      name,
      title: options?.title,
      description: options?.description,
      defaultValue: options?.defaultValue,
      required: options?.required ?? false,
    });
    return this;
  }

  addVariables(variables: AppVariable[]): this {
    this.variables.push(...variables);
    return this;
  }

  addSecret(
    name: string,
    options?: {
      title?: string;
      description?: string;
      required?: boolean;
    }
  ): this {
    this.secrets.push({
      name,
      title: options?.title,
      description: options?.description,
      required: options?.required ?? false,
    });
    return this;
  }

  addSecrets(secrets: AppSecret[]): this {
    this.secrets.push(...secrets);
    return this;
  }

  /**
   * Set the OAuth connector for OAuth2 custom apps
   */
  withOAuthConnector(
    connector: OAuthConnectorClass | OAuthConnectorFactory
  ): this {
    this.oauthConnector = connector;
    return this;
  }

  /**
   * Mark this custom app as the developer's own product (first-party).
   * Useful for distinguishing between third-party integrations and first-party apps.
   */
  asOwnApp(): this {
    this.isOwnApp = true;
    return this;
  }

  deploy(): CustomApp {
    const app: CustomApp = {
      name: this.name,
      type: this.type,
      title: this.title,
      variables: this.variables.length > 0 ? this.variables : undefined,
      secrets: this.secrets.length > 0 ? this.secrets : undefined,
      oauthConnector: this.oauthConnector,
      isOwnApp: this.isOwnApp,
    };

    // Register the custom app in the global registry
    registerCustomApp(app, {
      builderType: "CustomAppBuilder",
      createdBy: "defineCustomApp",
      variableCount: this.variables.length,
      secretCount: this.secrets.length,
    });

    return app;
  }
}

/**
 * Factory function for creating an OAuth2 custom app builder
 */
export function defineOAuth2CustomApp(name: string): CustomAppBuilder {
  return new CustomAppBuilder(name, "OAUTH2");
}

/**
 * Factory function for creating an API Key custom app builder
 */
export function defineApiKeyCustomApp(name: string): CustomAppBuilder {
  return new CustomAppBuilder(name, "APIKEY");
}

/**
 * Factory function for creating a Basic Auth custom app builder
 */
export function defineBasicCustomApp(name: string): CustomAppBuilder {
  return new CustomAppBuilder(name, "BASIC");
}

/**
 * Generic factory function for creating any custom app type
 */
export interface DefineCustomAppFn {
  (name: string, type: AppAuthType): CustomAppBuilder;
  from: (source: CustomApp | CustomAppBuilder) => CustomAppBuilder;
}

export const defineCustomApp: DefineCustomAppFn = ((
  name: string,
  type: AppAuthType
) => new CustomAppBuilder(name, type)) as unknown as DefineCustomAppFn;

defineCustomApp.from = (source: CustomApp | CustomAppBuilder) =>
  CustomAppBuilder.from(source);
