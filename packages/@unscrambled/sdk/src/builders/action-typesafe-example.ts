import type { Action, AppVariable, AppSecret } from "../types";

// Example of type-safe action builder with generics
type ExtractVariableNames<T extends readonly AppVariable[]> = T[number]["name"];
type ExtractSecretNames<T extends readonly AppSecret[]> = T[number]["name"];

type TypedVariables<T extends readonly AppVariable[]> = {
  [K in ExtractVariableNames<T>]: Extract<
    T[number],
    { name: K }
  >["required"] extends true
    ? string
    : string | null;
};

type TypedSecrets<T extends readonly AppSecret[]> = {
  [K in ExtractSecretNames<T>]: Extract<
    T[number],
    { name: K }
  >["required"] extends true
    ? string
    : string | null;
};

interface TypedRunFuncProps<
  V extends readonly AppVariable[],
  S extends readonly AppSecret[]
> {
  data?: any;
  context?: any;
  auths: any; // Keep as is for now
  variables: TypedVariables<V>;
  secrets: TypedSecrets<S>;
  webhook: string | null;
  integration: any; // Keep as is for now
  managedUser: any; // Keep as is for now
}

// Type-safe action builder
export class TypeSafeActionBuilder<
  V extends readonly AppVariable[] = [],
  S extends readonly AppSecret[] = []
> {
  private name: string;
  private title?: string;
  private description?: string;
  private variables: V;
  private secrets: S;
  private runFunction?: (props: TypedRunFuncProps<V, S>) => Promise<void>;

  constructor(name: string) {
    this.name = name;
    this.variables = [] as unknown as V;
    this.secrets = [] as unknown as S;
  }

  withTitle(title: string): this {
    this.title = title;
    return this;
  }

  withDescription(description: string): this {
    this.description = description;
    return this;
  }

  // Type-safe variable addition with const assertion
  addVariable<Name extends string>(
    name: Name,
    options?: {
      title?: string;
      description?: string;
      defaultValue?: string;
      required?: boolean;
    }
  ): TypeSafeActionBuilder<
    [
      ...V,
      {
        name: Name;
        required: boolean;
        title?: string;
        description?: string;
        defaultValue?: string;
      }
    ],
    S
  > {
    const newVariable = {
      name,
      title: options?.title,
      description: options?.description,
      defaultValue: options?.defaultValue,
      required: options?.required ?? false,
    } as const;

    return Object.assign(Object.create(Object.getPrototypeOf(this)), {
      ...this,
      variables: [...this.variables, newVariable] as any,
    });
  }

  // Type-safe secret addition
  addSecret<Name extends string>(
    name: Name,
    options?: {
      title?: string;
      description?: string;
      required?: boolean;
    }
  ): TypeSafeActionBuilder<
    V,
    [
      ...S,
      { name: Name; required: boolean; title?: string; description?: string }
    ]
  > {
    const newSecret = {
      name,
      title: options?.title,
      description: options?.description,
      required: options?.required ?? false,
    } as const;

    return Object.assign(Object.create(Object.getPrototypeOf(this)), {
      ...this,
      secrets: [...this.secrets, newSecret] as any,
    });
  }

  // Type-safe run function
  withRun(
    runFunction: (props: TypedRunFuncProps<V, S>) => Promise<void>
  ): this {
    this.runFunction = runFunction;
    return this;
  }

  deploy(): Action {
    // Convert back to standard Action type
    return {
      name: this.name,
      title: this.title,
      description: this.description,
      variables: this.variables.length > 0 ? [...this.variables] : undefined,
      secrets: this.secrets.length > 0 ? [...this.secrets] : undefined,
      run: this.runFunction as any,
    };
  }
}

// Example usage showing type safety:
export const exampleUsage = () => {
  const action = new TypeSafeActionBuilder("myAction")
    .addVariable("apiUrl", { required: true })
    .addVariable("timeout", { required: false })
    .addSecret("apiKey", { required: true })
    .addSecret("optionalToken", { required: false })
    .withRun(async ({ variables, secrets }) => {
      // TypeScript knows these types:
      // variables.apiUrl: string (required)
      // variables.timeout: string | null (optional)
      // secrets.apiKey: string (required)
      // secrets.optionalToken: string | null (optional)

      console.log(variables.apiUrl); // string
      console.log(variables.timeout); // string | null
      console.log(secrets.apiKey); // string
      console.log(secrets.optionalToken); // string | null

      // This would be a type error:
      // console.log(variables.unknownVar); // Error!
    });

  return action.deploy();
};
