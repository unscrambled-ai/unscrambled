import type { AppSecret, AppVariable, CustomApp, Webhook } from "../types";
import { registerWebhook } from "../registry";

type VariableConfig<
  Name extends string = string,
  Required extends boolean = boolean
> = {
  name: Name;
  title?: string;
  description?: string;
  defaultValue?: string;
  required: Required;
};

type SecretConfig<
  Name extends string = string,
  Required extends boolean = boolean
> = {
  name: Name;
  title?: string;
  description?: string;
  required: Required;
};

function getCustomAppName(customApp: CustomApp | string): string {
  return typeof customApp === "string" ? customApp : customApp.name;
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Webhook Builder - fluent API for creating deployable webhooks.
 */
export class WebhookBuilder<
  V extends readonly VariableConfig[] = [],
  S extends readonly SecretConfig[] = []
> {
  private name: string;
  private title?: string;
  private apps: string[] = [];
  private customApps: string[] = [];
  private variables: V;
  private secrets: S;

  constructor(name: string) {
    this.name = name;
    this.variables = [] as unknown as V;
    this.secrets = [] as unknown as S;
  }

  withName(name: string): WebhookBuilder<V, S> {
    const newBuilder = Object.create(Object.getPrototypeOf(this));
    return Object.assign(newBuilder, {
      ...this,
      name,
    });
  }

  withTitle(title: string): this {
    this.title = title;
    return this;
  }

  withApp(appName: string): this {
    this.apps = [appName];
    return this;
  }

  withApps(...appNames: string[]): this;
  withApps(appNames: string[]): this;
  withApps(...appNamesOrArray: string[] | [string[]]): this {
    const appNames = Array.isArray(appNamesOrArray[0])
      ? (appNamesOrArray[0] as string[])
      : (appNamesOrArray as string[]);
    this.apps = uniqueValues(appNames);
    return this;
  }

  addApp(appName: string): this;
  addApp(...appNames: string[]): this;
  addApp(...appNames: string[]): this {
    this.apps = uniqueValues([...this.apps, ...appNames]);
    return this;
  }

  addApps(...appNames: string[]): this;
  addApps(appNames: string[]): this;
  addApps(...appNamesOrArray: string[] | [string[]]): this {
    const appNames = Array.isArray(appNamesOrArray[0])
      ? (appNamesOrArray[0] as string[])
      : (appNamesOrArray as string[]);
    this.apps = uniqueValues([...this.apps, ...appNames]);
    return this;
  }

  withCustomApp(customApp: CustomApp | string): this {
    this.customApps = [getCustomAppName(customApp)];
    return this;
  }

  withCustomApps(...customApps: Array<CustomApp | string>): this;
  withCustomApps(customApps: Array<CustomApp | string>): this;
  withCustomApps(
    ...customAppsOrArray: Array<CustomApp | string> | [Array<CustomApp | string>]
  ): this {
    const customApps = Array.isArray(customAppsOrArray[0])
      ? (customAppsOrArray[0] as Array<CustomApp | string>)
      : (customAppsOrArray as Array<CustomApp | string>);
    this.customApps = uniqueValues(customApps.map(getCustomAppName));
    return this;
  }

  addCustomApp(customApp: CustomApp | string): this;
  addCustomApp(...customApps: Array<CustomApp | string>): this;
  addCustomApp(...customApps: Array<CustomApp | string>): this {
    this.customApps = uniqueValues([
      ...this.customApps,
      ...customApps.map(getCustomAppName),
    ]);
    return this;
  }

  addCustomApps(...customApps: Array<CustomApp | string>): this;
  addCustomApps(customApps: Array<CustomApp | string>): this;
  addCustomApps(
    ...customAppsOrArray: Array<CustomApp | string> | [Array<CustomApp | string>]
  ): this {
    const customApps = Array.isArray(customAppsOrArray[0])
      ? (customAppsOrArray[0] as Array<CustomApp | string>)
      : (customAppsOrArray as Array<CustomApp | string>);
    this.customApps = uniqueValues([
      ...this.customApps,
      ...customApps.map(getCustomAppName),
    ]);
    return this;
  }

  addVariable<Name extends string, Required extends boolean = false>(
    name: Name,
    options?: {
      title?: string;
      description?: string;
      defaultValue?: string;
      required?: Required;
    }
  ): WebhookBuilder<[...V, VariableConfig<Name, Required>], S> {
    const newVariable: VariableConfig<Name, Required> = {
      name,
      title: options?.title,
      description: options?.description,
      defaultValue: options?.defaultValue,
      required: (options?.required ?? false) as Required,
    };

    const newBuilder = Object.create(Object.getPrototypeOf(this));
    return Object.assign(newBuilder, {
      ...this,
      variables: [...this.variables, newVariable] as [
        ...V,
        VariableConfig<Name, Required>
      ],
    });
  }

  addVariables<NewVars extends readonly VariableConfig[]>(
    variables: NewVars
  ): WebhookBuilder<[...V, ...NewVars], S> {
    const newBuilder = Object.create(Object.getPrototypeOf(this));
    return Object.assign(newBuilder, {
      ...this,
      variables: [...this.variables, ...variables] as [...V, ...NewVars],
    });
  }

  withVariables<NewV extends readonly VariableConfig[]>(
    variables: NewV
  ): WebhookBuilder<NewV, S>;
  withVariables(variables: string[]): WebhookBuilder<VariableConfig[], S>;
  withVariables(variables: AppVariable[]): WebhookBuilder<VariableConfig[], S>;
  withVariables(
    variables: readonly VariableConfig[] | string[] | AppVariable[]
  ): WebhookBuilder<any, S> {
    const newBuilder = Object.create(Object.getPrototypeOf(this));
    const mappedVars = variables.map((v): VariableConfig => {
      if (typeof v === "string") {
        return { name: v } as unknown as VariableConfig;
      }
      return {
        name: v.name,
        title: v.title,
        description: v.description,
        defaultValue: v.defaultValue,
        required: v.required ?? false,
      };
    });
    return Object.assign(newBuilder, {
      ...this,
      variables: mappedVars,
    });
  }

  addSecret<Name extends string, Required extends boolean = false>(
    name: Name,
    options?: {
      title?: string;
      description?: string;
      required?: Required;
    }
  ): WebhookBuilder<V, [...S, SecretConfig<Name, Required>]> {
    const newSecret: SecretConfig<Name, Required> = {
      name,
      title: options?.title,
      description: options?.description,
      required: (options?.required ?? false) as Required,
    };

    const newBuilder = Object.create(Object.getPrototypeOf(this));
    return Object.assign(newBuilder, {
      ...this,
      secrets: [...this.secrets, newSecret] as [
        ...S,
        SecretConfig<Name, Required>
      ],
    });
  }

  addSecrets<NewSecrets extends readonly SecretConfig[]>(
    secrets: NewSecrets
  ): WebhookBuilder<V, [...S, ...NewSecrets]> {
    const newBuilder = Object.create(Object.getPrototypeOf(this));
    return Object.assign(newBuilder, {
      ...this,
      secrets: [...this.secrets, ...secrets] as [...S, ...NewSecrets],
    });
  }

  withSecrets<NewS extends readonly SecretConfig[]>(
    secrets: NewS
  ): WebhookBuilder<V, NewS>;
  withSecrets(secrets: string[]): WebhookBuilder<V, SecretConfig[]>;
  withSecrets(secrets: AppSecret[]): WebhookBuilder<V, SecretConfig[]>;
  withSecrets(
    secrets: readonly SecretConfig[] | string[] | AppSecret[]
  ): WebhookBuilder<V, any> {
    const newBuilder = Object.create(Object.getPrototypeOf(this));
    const mappedSecrets = secrets.map((s): SecretConfig => {
      if (typeof s === "string") {
        return { name: s } as unknown as SecretConfig;
      }
      return {
        name: s.name,
        title: s.title,
        description: s.description,
        required: s.required ?? false,
      };
    });
    return Object.assign(newBuilder, {
      ...this,
      secrets: mappedSecrets,
    });
  }

  static from<
    V extends readonly VariableConfig[],
    S extends readonly SecretConfig[]
  >(source: Webhook | WebhookBuilder<V, S>): WebhookBuilder<V, S> {
    if (source instanceof WebhookBuilder) {
      const builder = new WebhookBuilder<V, S>(source.name);
      builder.title = source.title;
      builder.apps = [...source.apps];
      builder.customApps = [...source.customApps];
      builder.variables = [...source.variables] as unknown as V;
      builder.secrets = [...source.secrets] as unknown as S;
      return builder;
    }

    const builder = new WebhookBuilder(source.name) as any;
    if (source.title) builder.title = source.title;
    if (source.apps) builder.apps = [...source.apps];
    if (source.customApps) builder.customApps = [...source.customApps];
    if (source.variables && source.variables.length > 0) {
      builder.variables = source.variables.map((variable) => ({
        name: variable.name,
        title: variable.title,
        description: variable.description,
        defaultValue: variable.defaultValue,
        required: variable.required ?? false,
      }));
    }
    if (source.secrets && source.secrets.length > 0) {
      builder.secrets = source.secrets.map((secret) => ({
        name: secret.name,
        title: secret.title,
        description: secret.description,
        required: secret.required ?? false,
      }));
    }
    return builder;
  }

  duplicateAs(newName: string): WebhookBuilder<V, S> {
    return WebhookBuilder.from(this).withName(newName);
  }

  deploy(): Webhook {
    const webhook: Webhook = {
      name: this.name,
      title: this.title,
      apps: this.apps.length > 0 ? [...this.apps] : undefined,
      customApps: this.customApps.length > 0 ? [...this.customApps] : undefined,
      variables:
        this.variables.length > 0
          ? this.variables.map((v) => {
              const variable: AppVariable = { name: v.name } as AppVariable;
              if (v.title !== undefined) variable.title = v.title;
              if (v.description !== undefined) {
                variable.description = v.description;
              }
              if (v.defaultValue !== undefined) {
                variable.defaultValue = v.defaultValue;
              }
              if (v.required !== undefined) {
                variable.required = v.required as boolean;
              }
              return variable;
            })
          : undefined,
      secrets:
        this.secrets.length > 0
          ? this.secrets.map((s) => {
              const secret: AppSecret = { name: s.name } as AppSecret;
              if (s.title !== undefined) secret.title = s.title;
              if (s.description !== undefined) {
                secret.description = s.description;
              }
              if (s.required !== undefined) {
                secret.required = s.required as boolean;
              }
              return secret;
            })
          : undefined,
    };

    registerWebhook(webhook, {
      builderType: "WebhookBuilder",
      createdBy: "defineWebhook",
      appCount: this.apps.length,
      customAppCount: this.customApps.length,
      variableCount: this.variables.length,
      secretCount: this.secrets.length,
    });

    return webhook;
  }
}

export interface DefineWebhookFn {
  (name: string): WebhookBuilder<[], []>;
  from: (source: Webhook | WebhookBuilder<any, any>) => WebhookBuilder<any, any>;
}

export const defineWebhook: DefineWebhookFn = ((name: string) =>
  new WebhookBuilder(name)) as DefineWebhookFn;

defineWebhook.from = (source: Webhook | WebhookBuilder<any, any>) =>
  WebhookBuilder.from(source) as WebhookBuilder<any, any>;
