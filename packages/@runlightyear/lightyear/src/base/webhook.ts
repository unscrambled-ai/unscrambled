import invariant from "tiny-invariant";
import baseRequest from "./baseRequest";
import { pushToDeployList } from "./deploy";
import { AppName } from "./action";
import { Auths, Secrets, Variables } from "../run";
import { AuthData } from "./auth";
import { prefixedRedactedConsole } from "../logging";
import { getEnvName } from "../util/getEnvName";
import {
  isValidName,
  validNameRegex,
  validVariableAndSecretNameRegex,
} from "../util/isValidName";
import { z } from "zod";
import { VariableDef } from "./variable";
import { SecretDef } from "./secret";
import { WebhookDelivery, WebhookDeliveryResponse } from "./delivery";

/**
 * @public
 */
export interface SubscribeFuncProps {
  endpoint: string;
  auths: Auths;
  variables: Variables;
  secrets: Secrets;
  subscribeProps: any;
}

/**
 * @public
 */
export interface UnsubscribeFuncProps {
  endpoint: string;
  auths: Auths;
  variables: Variables;
  secrets: Secrets;
  unsubscribeProps: any;
}

export interface RefreshSubscriptionFuncProps {
  endpoint: string;
  auths: Auths;
  variables: Variables;
  secrets: Secrets;
  unsubscribeProps: any;
  subscribeProps: any;
}

/**
 * @public
 */
export type SubscribeFunc = (props: SubscribeFuncProps) => Promise<object>;

/**
 * @public
 */
export type UnsubscribeFunc = (props: UnsubscribeFuncProps) => Promise<void>;

/**
 * @public
 */
export type RefreshSubscriptionFunc = (
  props: RefreshSubscriptionFuncProps
) => Promise<object>;

export interface ReceiveWebhookFuncProps {
  endpoint: string;
  auths: Auths;
  variables: Variables;
  secrets: Secrets;
  delivery: WebhookDelivery;
}

export interface ReceiveWebhookResponse {
  response: WebhookDeliveryResponse;
  triggerActions: boolean;
}

export type ReceiveWebhookFunc = (
  props: ReceiveWebhookFuncProps
) => Promise<ReceiveWebhookResponse>;

export type SubscribeIndex = {
  [name: string]: SubscribeFunc;
};

export type UnsubscribeIndex = {
  [name: string]: UnsubscribeFunc;
};

export type RefreshSubscriptionIndex = {
  [name: string]: RefreshSubscriptionFunc;
};

export type ReceiveDeliveryIndex = {
  [name: string]: ReceiveWebhookFunc;
};

/**
 * @public
 */
export type SubscribePropsFuncProps = {
  endpoint: string;
  auths: Auths;
  variables: Variables;
  secrets: Secrets;
};

/**
 * @public
 */
export type SubscribePropsFunc = (props: SubscribePropsFuncProps) => object;

/**
 * @public
 */
export interface DefineWebhookProps {
  /**
   * The name of this webhook.
   */
  name: string;
  /**
   * The title of this webhook.
   */
  title: string;
  /**
   * An array of the system apps used by this webhook.
   */
  apps?: Array<AppName>;
  /**
   * An array of the custom apps used by this webhook.
   */
  customApps?: Array<string>;
  /**
   * An array of the variables on this webhook.
   *
   * Variables are required to have a value by default. If you append a "?" to the end of the name, the variable will be optional. For example:
   *
   * ["requiredVar", "optionalVar?"]
   */
  variables?: Array<VariableDef>;
  /**
   * An array of the secrets on this webhook.
   *
   * Secrets are like variables, but they are stored more securely in the database and they are redacted in the console logs.
   *
   * Secrets are required to have a value by default. If you append a "?" to the end of the name, the secret will be optional. For example:
   *
   * ["requiredSecret", "optionalSecret?"]
   */
  secrets?: Array<SecretDef>;
  subscribeProps?: SubscribePropsFunc;
  subscribe?: SubscribeFunc;
  refreshSubscription?: RefreshSubscriptionFunc;
  receive?: ReceiveWebhookFunc;
  unsubscribe?: UnsubscribeFunc;
}

function validateWebhookProps(props: DefineWebhookProps) {
  const { name, title, apps, variables, secrets } = props;

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

  const DefineWebhookSchema = z
    .object({
      name: NameSchema,
      title: TitleSchema,
      apps: AppsSchema.optional(),
      customApps: CustomAppsSchema.optional(),
      variables: VariablesSchema.optional(),
      secrets: SecretsSchema.optional(),
      subscribeProps: z.function().optional(),
      subscribe: z.function().optional(),
      unsubscribe: z.function().optional(),
      refreshSubscription: z.function().optional(),
      receive: z.function().optional(),
    })
    .strict();

  if (name === undefined) {
    throw new Error("Webhook missing name");
  }

  if (!NameSchema.safeParse(name).success) {
    throw new Error(`Invalid webhook name: ${name}`);
  }

  if (title === undefined) {
    throw new Error(`Webhook ${name} missing title`);
  }

  if (!TitleSchema.safeParse(title).success) {
    throw new Error(`Invalid webhook title: ${title}`);
  }

  if (apps) {
    if (!AppsSchema.safeParse(apps).success) {
      throw new Error(
        `Invalid apps for action ${name}: ${apps} Must be an array of valid names`
      );
    }
  }

  if (variables) {
    if (!VariablesSchema.safeParse(variables).success) {
      throw new Error(
        `Invalid variables for webhook ${name}: ${variables} Must be an array of valid names or objects with name and optional description`
      );
    }
  }

  if (secrets) {
    if (!SecretsSchema.safeParse(secrets).success) {
      throw new Error(
        `Invalid secrets for webhook ${name}: ${secrets} Must be an array of valid names or objects with name and optional description`
      );
    }
  }

  const fullResult = DefineWebhookSchema.safeParse(props);
  if (!fullResult.success) {
    const messages = fullResult.error.issues.map((issue) => issue.message);
    throw new Error(
      `Invalid definition for webhook ${name}: ${messages.join(", ")}`
    );
  }
}

/**
 * @public
 *
 * Define a Webhook
 *
 * @example Basic webhook
 * ```typescript
 * import { defineWebhook } from "@runlightyear/lightyear";
 *
 * defineWebhook({
 *   name: "basicWebhook",
 *   title: "Basic Webhook",
 * });
 *```
 *
 * @example Webhook with variables
 * ```typescript
 * import { defineWebhook } from "@runlightyear/lightyear";
 *
 * defineWebhook({
 *   name: "webhookWithVariables",
 *   title: "Webhook with Variables",
 *   variables: [
 *     "var1",
 *     "var2?",
 *     {
 *       name: "var3",
 *       description: "Required variable 3",
 *     },
 *     {
 *       name: "var4?",
 *       description: "Optional variable 4",
 *     },
 *   ],
 * });
 * ```
 *
 * @example Webhook with secrets
 * ```typescript
 * import { defineWebhook } from "@runlightyear/lightyear";
 *
 * defineWebhook({
 *   name: "webhookWithSecrets",
 *   title: "Webhook with Secrets",
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
 * });
 * ```
 *
 * @example With subscription
 *
 * ```typescript
 * defineWebhook({
 *   name: "subscriptionWebhook",
 *   title: "Subscription Webhook",
 *   subscribeProps: () => {
 *     // returns the props to be passed into subscribe
 *     // represents essential parameters to create the subscription
 *   },
 *   subscribe: ({ subscribeProps }) => {
 *     // runs after a change in subscribeProps is detected
 *     // code to create subscription using subscribe props
 *     // return value becomes unsubscribeProps for unsubscribe
 *     // for example: hook id returned by rest api call
 *   },
 *   refreshSubscription: ({ refreshSubscriptionProps }) => {
 *     // runs when a subscription is close to expiring
 *   },
 *   unsubscribe: ({ unsubscribeProps }) => {
 *      // if subscribed, runs after a change in subscribeProps is detected
 *      // code to unsubscribe using unsubscribe props
 *   },
 * })
 * ```
 *
 * @param props
 */
export function defineWebhook(props: DefineWebhookProps) {
  console.debug("in defineWebhook", props);

  validateWebhookProps(props);

  pushToDeployList({
    type: "webhook",
    webhookProps: props,
  });
  if (props.subscribe) {
    globalThis.subscribeIndex[props.name] = props.subscribe;
  }
  if (props.unsubscribe) {
    globalThis.unsubscribeIndex[props.name] = props.unsubscribe;
  }
  if (props.refreshSubscription) {
    globalThis.refreshSubscriptionIndex[props.name] = props.refreshSubscription;
  }
  if (props.receive) {
    globalThis.receiveDeliveryIndex[props.name] = props.receive;
  }

  return props.name;
}

export async function deployWebhook(
  envName: string,
  props: DefineWebhookProps
) {
  validateWebhookProps(props);

  const { name } = props;

  const response = await baseRequest({
    uri: `/api/v1/projects/default/envs/${envName}/webhooks`,
    data: {
      name,
    },
  });

  if (!response.ok) {
    console.error(await response.json());
    throw new Error(`deployWebhook failed: ${name}`);
  }

  console.info(`Deployed webhook: ${name}`);
}

export type WebhookData = {
  endpoint: string;
  auths: {
    [name: string]: AuthData;
  };
  variables: {
    [name: string]: string | null;
  };
  secrets: {
    [name: string]: string | null;
  };
  subscribeProps: any;
  unsubscribeProps: any;
};

/**
 * @internal
 *
 * @param name
 */
export async function getWebhookData(name: string): Promise<WebhookData> {
  const envName = getEnvName();
  invariant(envName, "Missing ENV_NAME");

  const response = await baseRequest({
    method: "GET",
    uri: `/api/v1/projects/default/envs/${envName}/webhooks/${name}/data`,
  });

  const data = <WebhookData>await response.json();

  const {
    endpoint,
    auths,
    variables,
    secrets,
    subscribeProps,
    unsubscribeProps,
  } = data;

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
    endpoint,
    auths,
    variables,
    secrets,
    subscribeProps,
    unsubscribeProps,
  };
}
