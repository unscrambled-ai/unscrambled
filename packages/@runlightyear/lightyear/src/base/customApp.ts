import { z } from "zod";
import {
  validNameRegex,
  validVariableAndSecretNameRegex,
} from "../util/isValidName";
import { pushToDeployList } from "./deploy";
import {
  OAuthConnector,
  OAuthConnectorProps,
} from "../connectors/OAuthConnector";
import { BaseConnector } from "../connectors/BaseConnector";
import { VariableDef } from "./variable";
import {
  AppWebhookConnector,
  AppWebhookConnectorProps,
} from "../connectors/AppWebhookConnector";
import invariant from "tiny-invariant";
import { getEnvName } from "../util/getEnvName";
import { AuthData, baseRequest, Secrets, Variables } from "../index";
import { prefixedRedactedConsole } from "../logging";

/**
 * @beta
 */

export type AppWebhookFunc = (
  props: AppWebhookConnectorProps
) => AppWebhookConnector;

export type CustomAppWebhookIndex = {
  [customAppName: string]: AppWebhookFunc;
};

export interface DefineCustomAppConnectorProps {
  authType?: undefined;
  name: string;
  title: string;
  connector: typeof BaseConnector;
  oauth?: (props: OAuthConnectorProps) => OAuthConnector;
  appWebhook?: AppWebhookFunc;
  variables?: Array<VariableDef>;
  secrets?: Array<VariableDef>;
}

export interface DefineCustomAppBasicProps {
  authType: "BASIC";
  name: string;
  title: string;
  variables?: Array<VariableDef>;
  secrets?: Array<VariableDef>;
}

export interface DefineCustomAppApiKeyProps {
  authType: "APIKEY";
  name: string;
  title: string;
  variables?: Array<VariableDef>;
  secrets?: Array<VariableDef>;
}

export interface DefineCustomAppOAuthProps {
  authType: "OAUTH2";
  name: string;
  title: string;
  oauth?: (props: OAuthConnectorProps) => OAuthConnector;
  appWebhook?: AppWebhookFunc;
  variables?: Array<VariableDef>;
  secrets?: Array<VariableDef>;
}

export type DefineCustomAppProps =
  | DefineCustomAppConnectorProps
  | DefineCustomAppBasicProps
  | DefineCustomAppApiKeyProps
  | DefineCustomAppOAuthProps;

export interface DeployCustomAppBasicProps {
  authType: "BASIC";
  name: string;
  title: string;
  variables?: Array<VariableDef>;
  secrets?: Array<VariableDef>;
}
export interface DeployCustomAppApiKeyProps {
  authType: "APIKEY";
  name: string;
  title: string;
  variables?: Array<VariableDef>;
  secrets?: Array<VariableDef>;
}
export interface DeployCustomAppOAuthProps {
  authType: "OAUTH2";
  name: string;
  title: string;
  hasOAuth?: boolean;
  hasAppWebhook?: boolean;
  variables?: Array<VariableDef>;
  secrets?: Array<VariableDef>;
}

export type DeployCustomAppProps =
  | DeployCustomAppBasicProps
  | DeployCustomAppApiKeyProps
  | DeployCustomAppOAuthProps;

export function validateCustomAppProps(props: DefineCustomAppProps) {
  const { name, title } = props;

  const NameSchema = z.string().min(1).regex(validNameRegex);
  const TitleSchema = z.string().min(1);
  const ConnectorSchema = z.custom<typeof BaseConnector>(
    (value) => {
      if (typeof value === "function") {
        return value.prototype instanceof BaseConnector;
      }
      return false;
    },
    {
      message: "Connector class must be a subclass of BaseConnector",
    }
  );
  const OAuthSchema = z.custom<(props: OAuthConnectorProps) => OAuthConnector>(
    (value) => {
      return typeof value === "function";
    }
  );
  const AppWebhookSchema = z.custom<AppWebhookFunc>((value) => {
    return typeof value === "function";
  });
  const VariableAndSecretNameSchema = z.union([
    z.string().min(1).regex(validVariableAndSecretNameRegex),
    z.object({
      name: z.string().min(1).regex(validVariableAndSecretNameRegex),
      description: z.string().optional(),
    }),
  ]);
  const VariablesSchema = z.array(VariableAndSecretNameSchema);
  const SecretsSchema = z.array(VariableAndSecretNameSchema);

  const DefineCustomAppSchema = z.discriminatedUnion("authType", [
    z
      .object({
        authType: z.undefined(),
        name: NameSchema,
        title: TitleSchema,
        connector: ConnectorSchema.optional(),
        oauth: OAuthSchema.optional(),
        appWebhook: AppWebhookSchema.optional(),
        variables: VariablesSchema.optional(),
        secrets: SecretsSchema.optional(),
      })
      .strict(),
    z
      .object({
        authType: z.literal("BASIC"),
        name: NameSchema,
        title: TitleSchema,
        variables: VariablesSchema.optional(),
        secrets: SecretsSchema.optional(),
      })
      .strict(),
    z
      .object({
        authType: z.literal("APIKEY"),
        name: NameSchema,
        title: TitleSchema,
        variables: VariablesSchema.optional(),
        secrets: SecretsSchema.optional(),
      })
      .strict(),
    z
      .object({
        authType: z.literal("OAUTH2"),
        name: NameSchema,
        title: TitleSchema,
        oauth: OAuthSchema.optional(),
        appWebhook: AppWebhookSchema.optional(),
        variables: VariablesSchema.optional(),
        secrets: SecretsSchema.optional(),
      })
      .strict(),
  ]);

  if (name === undefined) {
    throw new Error("Custom app missing required name");
  }

  if (!NameSchema.safeParse(name).success) {
    throw new Error(`Invalid custom app name: ${name}`);
  }

  if (title === undefined) {
    throw new Error(`Custom app missing required title: ${name}`);
  }

  if (!TitleSchema.safeParse(title).success) {
    throw new Error(`Invalid custom app title '${title}' for: ${name}`);
  }

  if ("authType" in props && "connector" in props) {
    throw new Error(`Cannot specify both authType and connector for: ${name}`);
  }

  const fullResult = DefineCustomAppSchema.safeParse(props);
  if (!fullResult.success) {
    const messages = fullResult.error.issues.map((issue) => issue.message);
    throw new Error(
      `Invalid custom app definition for ${name}: ${messages.join(", ")}`
    );
  }

  return fullResult.data;
}

/**
 * @beta
 *
 * Define a Custom App
 *
 */
export function defineCustomApp(props: DefineCustomAppProps) {
  console.debug("in defineCustomApp", props);

  const validatedProps = validateCustomAppProps(props);

  const connectorOAuth =
    "connector" in validatedProps ? validatedProps.connector?.OAuth : null;
  const connectorAppWebhook =
    "connector" in validatedProps ? validatedProps.connector?.AppWebhook : null;
  const connectorVariables =
    "connector" in validatedProps ? validatedProps.connector?.variables : [];
  const connectorSecrets =
    "connector" in validatedProps ? validatedProps.connector?.secrets : [];

  const authType =
    "connector" in validatedProps
      ? validatedProps.connector?.authType
      : validatedProps.authType;

  if (authType === undefined) {
    if ("connector" in validatedProps) {
      throw new Error(
        `authType is undefined, check the connector definition for ${validatedProps.name}`
      );
    } else {
      throw new Error(`authType is undefined for ${validatedProps.name}`);
    }
  }

  const deployProps = {
    ...validatedProps,
    authType,
    ...(connectorOAuth ||
    (validatedProps.authType === "OAUTH2" && validatedProps.oauth)
      ? { hasOAuth: true }
      : {}),
    ...(connectorAppWebhook ||
    (validatedProps.authType === "OAUTH2" && validatedProps.appWebhook)
      ? { hasAppWebhook: true }
      : {}),
    variables: validatedProps.variables ?? connectorVariables,
    secrets: validatedProps.secrets ?? connectorSecrets,
  };

  if ("connector" in deployProps) {
    delete deployProps.connector;
  }
  if ("oauth" in deployProps) {
    delete deployProps.oauth;
  }
  if ("appWebhook" in deployProps) {
    delete deployProps.appWebhook;
  }

  pushToDeployList({
    type: "customApp",
    customAppProps: deployProps,
  });

  if (validatedProps.authType === "OAUTH2") {
    const { oauth, appWebhook } = validatedProps;

    if (oauth) {
      globalThis.authorizerIndex[props.name] = oauth;
    }

    if (appWebhook) {
      globalThis.customAppWebhookIndex[props.name] = appWebhook;
    }
  } else if (validatedProps.authType === undefined) {
    const { connector, oauth, appWebhook } = validatedProps;

    if (oauth) {
      globalThis.authorizerIndex[props.name] = oauth;
    } else if (connector?.OAuth) {
      globalThis.authorizerIndex[props.name] = (props) => {
        // @ts-ignore - We are assuming the user passed in a concrete class. Is there a way to verify this?
        return new connector.OAuth(props);
      };
    }

    if (appWebhook) {
      globalThis.customAppWebhookIndex[props.name] = appWebhook;
    } else if (connector?.AppWebhook) {
      globalThis.customAppWebhookIndex[props.name] = (props) => {
        // @ts-ignore - We are assuming the user passed in a concrete class.
        return new connector.AppWebhook(props);
      };
    }
  }

  return props.name;
}

export interface GetCustomAppWebhookDataProps {
  customAppName: string;
}

export interface CustomAppWebhookData {
  auth: AuthData | null;
  variables: Variables;
  secrets: Secrets;
}

export async function getCustomAppWebhookData(
  props: GetCustomAppWebhookDataProps
): Promise<CustomAppWebhookData> {
  const { customAppName } = props;

  const envName = getEnvName();
  invariant(envName, "Missing ENV_NAME");

  const response = await baseRequest({
    method: "GET",
    uri: `/api/v1/projects/default/envs/${envName}/custom-apps/${customAppName}/webhook/data`,
  });

  const data = (await response.json()) as CustomAppWebhookData;

  const { secrets } = data;

  secrets && prefixedRedactedConsole.addSecrets(Object.values(secrets));

  return data;
}
