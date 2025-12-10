import invariant from "tiny-invariant";
import isFunction from "../util/isFunction";
import baseRequest from "./baseRequest";
import { RunFunc } from "../run";
import { pushToDeployList } from "./deploy";
import { prefixedRedactedConsole } from "../logging";
import { AuthData } from "./auth";
import { getEnvName } from "../util/getEnvName";
import {
  validNameRegex,
  validVariableAndSecretNameRegex,
} from "../util/isValidName";
import { z } from "zod";
import { VariableDef } from "./variable";
import { SecretDef } from "./secret";

export type AppName =
  | "airtable"
  | "gcal"
  | "github"
  | "gmail"
  | "gsheets"
  | "hubspot"
  | "linear"
  | "notion"
  | "openai"
  | "postmark"
  | "salesforce"
  | "slack"
  | "smtp"
  | "zoom";

export type ActionTrigger = {
  webhook?: string;
  schedule?: string;
  pollingFrequency?: number;
};

/**
 * @public
 */
export interface DefineActionProps {
  /**
   * The name of this action.
   */
  name: string;
  /**
   * The title of this action.
   */
  title: string;
  trigger?: ActionTrigger;
  /**
   * An array of the system apps used by this action.
   */
  apps?: Array<AppName>;
  /**
   * An array of the custom apps used by this action.
   */
  customApps?: Array<string>;
  /**
   * An array of the variables on this action.
   *
   * Variables are required to have a value by default. If you append a "?" to the end of the name, the variable will be optional. For example:
   *
   * ["requiredVar", "optionalVar?"]
   */
  variables?: Array<VariableDef>;
  /**
   * An array of the secrets on this action.
   *
   * Secrets are like variables, but they are stored more securely in the database and they are redacted in the console logs.
   *
   * Secrets are required to have a value by default. If you append a "?" to the end of the name, the secret will be optional. For example:
   *
   * ["requiredSecret", "optionalSecret?"]
   */
  secrets?: Array<SecretDef>;
  /**
   * The function to run when this action is triggered.
   */
  run: RunFunc;
}

export interface DeployActionProps {
  name: string;
  title: string;
  description?: string;
  trigger?: ActionTrigger;
}

export interface SetActionInitializedProps {
  name: string;
  title: string;
  status: boolean;
}

function validateActionProps(props: DefineActionProps) {
  const { name, title, trigger, apps, customApps, variables, secrets } = props;

  const NameSchema = z.string().min(1).regex(validNameRegex);
  const TitleSchema = z.string().min(1);

  const AppsSchema = z.array(NameSchema);
  const CustomAppsSchema = z.array(NameSchema);

  const VariableAndSecretNameSchema = z.union([
    z.string().min(1).regex(validVariableAndSecretNameRegex),
    z.object({
      name: z.string().min(1).regex(validVariableAndSecretNameRegex),
      description: z.string().optional(),
    }),
  ]);
  const VariablesSchema = z.array(VariableAndSecretNameSchema);
  const SecretsSchema = z.array(VariableAndSecretNameSchema);

  const WebhookSchema = NameSchema;
  const PollingFrequencySchema = z.number().int().positive();

  const RunSchema = z.function();

  const DefineActionSchema = z
    .object({
      name: NameSchema,
      title: TitleSchema,
      apps: AppsSchema.optional(),
      customApps: CustomAppsSchema.optional(),
      variables: VariablesSchema.optional(),
      secrets: SecretsSchema.optional(),
      trigger: z
        .object({
          webhook: WebhookSchema.optional(),
          schedule: z.string().optional(),
          pollingFrequency: PollingFrequencySchema.optional(),
        })
        .strict()
        .optional(),
      run: RunSchema,
    })
    .strict();

  if (name === undefined) {
    throw new Error("Action missing name");
  }

  if (!NameSchema.safeParse(name).success) {
    throw new Error(`Invalid action name: ${name}`);
  }

  if (title === undefined) {
    throw new Error(`Action ${name} missing title`);
  }

  if (!TitleSchema.safeParse(title).success) {
    throw new Error(`Invalid action title: ${title}`);
  }

  if (apps) {
    if (!AppsSchema.safeParse(apps).success) {
      throw new Error(
        `Invalid apps for action ${name}: ${apps} Must be an array of valid names`
      );
    }
  }

  if (customApps) {
    if (!CustomAppsSchema.safeParse(customApps).success) {
      throw new Error(
        `Invalid customApps for action ${name}: ${customApps} Must be an array of valid names`
      );
    }
  }

  if (variables) {
    if (!VariablesSchema.safeParse(variables).success) {
      throw new Error(
        `Invalid variables for action ${name}: Must be an array of valid names or objects with name and optional description`
      );
    }
  }

  if (secrets) {
    if (!SecretsSchema.safeParse(secrets).success) {
      throw new Error(
        `Invalid secrets for action ${name}: Must be an array of valid names or objects with name and optional description`
      );
    }
  }

  if (trigger) {
    const array = [
      "webhook" in trigger ? 1 : 0,
      "schedule" in trigger ? 1 : 0,
      "pollingFrequency" in trigger ? 1 : 0,
    ];
    const sum: number = array.reduce((sum, x) => sum + x);

    if (sum !== 1) {
      throw new Error(
        `Must specify one and only one of webhook and pollingFrequency on trigger ${name}`
      );
      // throw new Error(
      //   `Must specify one and only one of webhook, schedule, and pollingFrequency on trigger`
      // );
    }
    if ("webhook" in trigger) {
      if (!WebhookSchema.safeParse(trigger.webhook).success) {
        throw new Error(
          `Webhook for action ${name} must be a valid name: ${trigger.webhook}`
        );
      }
    } else if ("pollingFrequency" in trigger) {
      if (!PollingFrequencySchema.safeParse(trigger.pollingFrequency).success) {
        throw new Error(
          `Polling frequency for action ${name} must be a positive integer: ${trigger.pollingFrequency}`
        );
      }
    } else if ("schedule" in trigger) {
      throw new Error(
        "Schedule not yet supported, try pollingFrequency for now."
      );
    }
  }

  const fullResult = DefineActionSchema.safeParse(props);
  if (!fullResult.success) {
    const messages = fullResult.error.issues.map((issue) => issue.message);
    throw new Error(
      `Invalid action definition for action ${name}: ${messages.join(", ")}`
    );
  }
}

/**
 * @public
 *
 * Define an Action
 *
 * @example Hello World
 * ```typescript
 * import { defineAction } from "@runlightyear/lightyear";
 *
 * defineAction({
 *   name: "helloWorld",
 *   title: "Hello World",
 *   run: async () => {
 *     console.log("Hello world");
 *   },
 * });
 * ```
 *
 * @example Variables
 * ```typescript
 * import { defineAction } from "@runlightyear/lightyear";
 *
 * defineAction({
 *   name: "actionWithVariables",
 *   title: "Action with Variables",
 *   variables: [
 *     "var1",
 *     "var2?",
 *     { name: "var3", description: "Required variable 3" },
 *     { name: "var4?", description: "Optional variable 4" },
 *   ],
 *   run: async ({ variables }) => {
 *     console.log("required variable", variables.var1);
 *     console.log("optional variable", variables.var2);
 *     console.log("variable with description", variables.var3);
 *     console.log("optional variable with description", variables.var4);
 *   },
 * });
 * ```
 *
 * @example Secrets
 * ```typescript
 * import { defineAction } from "@runlightyear/lightyear";
 *
 * defineAction({
 *   name: "actionWithSecrets",
 *   title: "Action with Secrets",
 *   secrets: [
 *     "secret1",
 *     "secret2?",
 *     {
 *       name: "secret3",
 *       description: "Required secret 3",
 *     },
 *     {
 *       name: "secret4?",
 *       description: "Optional secret 4",
 *     },
 *   ],
 *   run: async ({ secrets }) => {
 *     console.log("required secret", secrets.secret1);
 *     console.log("optional secret", secrets.secret2);
 *     console.log("secret with description", secrets.secret3);
 *     console.log("optional secret with description", secrets.secret4);
 *   },
 * });
 * ```
 *
 * @param props
 */
export function defineAction(props: DefineActionProps) {
  console.debug("in defineAction", props);

  const { run, ...rest } = props;
  validateActionProps(props);
  invariant(run, "Run function missing");
  invariant(isFunction(run), "Run must be a function");

  pushToDeployList({ type: "action", actionProps: rest });
  globalThis.actionIndex[rest.name] = run;

  return rest.name;
}

export type ActionData = {
  auths: {
    [name: string]: AuthData;
  };
  variables: {
    [name: string]: string | null;
  };
  secrets: {
    [name: string]: string | null;
  };
  webhook: string | null;
};

export async function getActionData(name: string): Promise<ActionData> {
  const envName = getEnvName();
  invariant(envName, "Missing ENV_NAME");

  const response = await baseRequest({
    method: "GET",
    uri: `/api/v1/projects/default/envs/${envName}/actions/${name}/data`,
  });

  const data = <ActionData>await response.json();

  const { auths, variables, secrets, webhook } = data;

  if (auths) {
    for (const auth of Object.values(auths)) {
      const { accessToken, refreshToken, apiKey } = auth;

      accessToken && prefixedRedactedConsole.addSecrets([accessToken]);
      refreshToken && prefixedRedactedConsole.addSecrets([refreshToken]);
      apiKey && prefixedRedactedConsole.addSecrets([apiKey]);
    }
  }

  if (secrets) {
    prefixedRedactedConsole.addSecrets(Object.values(secrets));
  }

  return {
    auths,
    variables,
    secrets,
    webhook,
  };
}
