import type {
  Action,
  ActionType,
  CustomApp,
  AppVariable,
  AppSecret,
  RunFunc,
  RunFuncProps,
  RunFuncIntegration,
  RunFuncManagedUser,
  Auths,
} from "../types";
import { registerAction } from "../registry";

// Global action index to store run functions (similar to lightyear package)
declare global {
  var actionIndex: { [name: string]: RunFunc };
}

// Initialize global action index if it doesn't exist
if (typeof globalThis !== "undefined") {
  globalThis.actionIndex = globalThis.actionIndex || {};
}

// Type helpers for extracting variable/secret configurations
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

// Extract types from variable/secret arrays
type ExtractVariableNames<T extends readonly VariableConfig[]> =
  T[number]["name"];
type ExtractSecretNames<T extends readonly SecretConfig[]> = T[number]["name"];

// Create typed variable/secret objects based on required status
type TypedVariables<T extends readonly VariableConfig[]> = {
  [K in ExtractVariableNames<T>]: Extract<
    T[number],
    { name: K }
  >["required"] extends true
    ? string
    : string | null;
};

type TypedSecrets<T extends readonly SecretConfig[]> = {
  [K in ExtractSecretNames<T>]: Extract<
    T[number],
    { name: K }
  >["required"] extends true
    ? string
    : string | null;
};

// Type-safe run function props
export interface TypedRunFuncProps<
  V extends readonly VariableConfig[],
  S extends readonly SecretConfig[]
> {
  data?: any;
  context?: any;
  auths: Auths;
  variables: TypedVariables<V>;
  secrets: TypedSecrets<S>;
  webhook: string | null;
  integration: RunFuncIntegration | null;
  managedUser: RunFuncManagedUser | null;
}

// Type-safe run function
export type TypedRunFunc<
  V extends readonly VariableConfig[],
  S extends readonly SecretConfig[]
> = (props: TypedRunFuncProps<V, S>) => Promise<void>;

/**
 * Action Builder - fluent API for creating actions with type safety
 */
export class ActionBuilder<
  V extends readonly VariableConfig[] = [],
  S extends readonly SecretConfig[] = []
> {
  private name: string;
  private title?: string;
  private description?: string;
  private type?: ActionType;
  private variables: V;
  private secrets: S;
  private runFunction?: TypedRunFunc<V, S>;

  constructor(name: string) {
    this.name = name;
    this.variables = [] as unknown as V;
    this.secrets = [] as unknown as S;
  }

  /**
   * Change the builder's name. Useful when duplicating an action.
   */
  withName(name: string): ActionBuilder<V, S> {
    const newBuilder = Object.create(Object.getPrototypeOf(this));
    return Object.assign(newBuilder, {
      ...this,
      name,
    });
  }

  withTitle(title: string): ActionBuilder<V, S> {
    this.title = title;
    return this;
  }

  withDescription(description: string): ActionBuilder<V, S> {
    this.description = description;
    return this;
  }

  withType(type: ActionType): ActionBuilder<V, S> {
    this.type = type;
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
  ): ActionBuilder<[...V, VariableConfig<Name, Required>], S> {
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
  ): ActionBuilder<[...V, ...NewVars], S> {
    const newBuilder = Object.create(Object.getPrototypeOf(this));
    return Object.assign(newBuilder, {
      ...this,
      variables: [...this.variables, ...variables] as [...V, ...NewVars],
    });
  }

  /**
   * Overwrite variables with the provided array (does not append).
   */
  withVariables<NewV extends readonly VariableConfig[]>(
    variables: NewV
  ): ActionBuilder<NewV, S>;
  withVariables(variables: string[]): ActionBuilder<VariableConfig[], S>;
  withVariables(variables: AppVariable[]): ActionBuilder<VariableConfig[], S>;
  withVariables(
    variables: readonly VariableConfig[] | string[] | AppVariable[]
  ): ActionBuilder<any, S> {
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
  ): ActionBuilder<V, [...S, SecretConfig<Name, Required>]> {
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
  ): ActionBuilder<V, [...S, ...NewSecrets]> {
    const newBuilder = Object.create(Object.getPrototypeOf(this));
    return Object.assign(newBuilder, {
      ...this,
      secrets: [...this.secrets, ...secrets] as [...S, ...NewSecrets],
    });
  }

  /**
   * Overwrite secrets with the provided array (does not append).
   */
  withSecrets<NewS extends readonly SecretConfig[]>(
    secrets: NewS
  ): ActionBuilder<V, NewS>;
  withSecrets(secrets: string[]): ActionBuilder<V, SecretConfig[]>;
  withSecrets(secrets: AppSecret[]): ActionBuilder<V, SecretConfig[]>;
  withSecrets(
    secrets: readonly SecretConfig[] | string[] | AppSecret[]
  ): ActionBuilder<V, any> {
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

  /**
   * Set the function to run when this action is executed
   */
  withRun(runFunction: TypedRunFunc<V, S>): ActionBuilder<V, S> {
    this.runFunction = runFunction;
    return this;
  }

  /**
   * Create a builder from an existing action or builder (copy constructor pattern).
   */
  static from<
    V extends readonly VariableConfig[],
    S extends readonly SecretConfig[]
  >(source: Action | ActionBuilder<V, S>): ActionBuilder<V, S> {
    if (source instanceof ActionBuilder) {
      const builder = new ActionBuilder<V, S>(source.name);
      builder.title = source.title;
      builder.description = source.description;
      builder.type = source.type;
      builder.variables = [...source.variables] as unknown as V;
      builder.secrets = [...source.secrets] as unknown as S;
      builder.runFunction = source.runFunction;
      return builder;
    }

    const action = source as Action;
    const builder = new ActionBuilder(action.name) as any;
    if (action.title) builder.title = action.title;
    if (action.description) builder.description = action.description;
    if (action.type) builder.type = action.type;
    if (action.variables && action.variables.length > 0) {
      const newBuilder = builder.withVariables(action.variables);
      if (action.secrets && action.secrets.length > 0) {
        return newBuilder.withSecrets(action.secrets) as any;
      }
      if (action.run) newBuilder.runFunction = action.run as any;
      return newBuilder;
    }
    if (action.secrets && action.secrets.length > 0) {
      const newBuilder = builder.withSecrets(action.secrets);
      if (action.run) newBuilder.runFunction = action.run as any;
      return newBuilder;
    }
    if (action.run) builder.runFunction = action.run as any;
    return builder;
  }

  /**
   * Backwards-compatible alias of from() for actions.
   */
  static fromAction(action: Action): ActionBuilder<any, any> {
    return ActionBuilder.from(action);
  }

  /**
   * Duplicate this builder into a new one with a different name.
   * Title and other fields can be overridden on the returned builder.
   */
  duplicateAs(newName: string): ActionBuilder<V, S> {
    return ActionBuilder.from(this).withName(newName);
  }

  deploy(): Action {
    const action: Action = {
      name: this.name,
      title: this.title,
      description: this.description,
      type: this.type,
      variables:
        this.variables.length > 0
          ? this.variables.map((v) => {
              const variable: AppVariable = { name: v.name } as AppVariable;
              if (v.title !== undefined) variable.title = v.title;
              if (v.description !== undefined)
                variable.description = v.description;
              if (v.defaultValue !== undefined)
                variable.defaultValue = v.defaultValue;
              if (v.required !== undefined)
                variable.required = v.required as boolean;
              return variable;
            })
          : undefined,
      secrets:
        this.secrets.length > 0
          ? this.secrets.map((s) => {
              const secret: AppSecret = { name: s.name } as AppSecret;
              if (s.title !== undefined) secret.title = s.title;
              if (s.description !== undefined)
                secret.description = s.description;
              if (s.required !== undefined)
                secret.required = s.required as boolean;
              return secret;
            })
          : undefined,
      run: this.runFunction as any, // Cast needed due to type variance
    };

    // Store the run function in the global action index (if provided)
    if (this.runFunction && typeof globalThis !== "undefined") {
      globalThis.actionIndex = globalThis.actionIndex || {};
      globalThis.actionIndex[this.name] = this.runFunction as any;
    }

    // Register the action in the global registry
    registerAction(action, {
      builderType: "ActionBuilder",
      createdBy: "defineAction",
      variableCount: this.variables.length,
      secretCount: this.secrets.length,
      hasRunFunction: !!this.runFunction,
    });

    return action;
  }
}

/**
 * Factory function for creating an action builder
 */
export interface DefineActionFn {
  (name: string): ActionBuilder<[], []>;
  from: (source: Action | ActionBuilder<any, any>) => ActionBuilder<any, any>;
  fromAction: (action: Action) => ActionBuilder<any, any>;
}

export const defineAction: DefineActionFn = ((name: string) =>
  new ActionBuilder(name)) as DefineActionFn;

defineAction.from = (source: Action | ActionBuilder<any, any>) =>
  ActionBuilder.from(source) as ActionBuilder<any, any>;

defineAction.fromAction = (action: Action) =>
  ActionBuilder.from(action) as ActionBuilder<any, any>;

// Export type-safe types - these are now defined above, not re-exported
