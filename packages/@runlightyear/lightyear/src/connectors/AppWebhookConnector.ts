import { WebhookDelivery, AppWebhookDeliveryResponse } from "../base/delivery";
import { Secrets, Variables } from "../run";
import { AuthConnector, AuthConnectorProps } from "./AuthConnector";
import { getEnvName } from "../util/getEnvName";
import { getContext } from "../base/context";
import baseRequest from "../base/baseRequest";

export interface AppWebhookConnectorProps extends AuthConnectorProps {
  variables?: Variables;
  secrets?: Secrets;
  inDevelopment?: boolean;
}

export abstract class AppWebhookConnector extends AuthConnector {
  camelize: boolean = true;
  variables: Variables;
  secrets: Secrets;
  inDevelopment: boolean;

  constructor(props: AppWebhookConnectorProps) {
    super(props);
    const { variables, secrets, inDevelopment } = props;

    this.variables = variables || {};
    this.secrets = secrets || {};
    this.inDevelopment = Boolean(inDevelopment);
  }

  getRedactHeaders() {
    return ["cookie", "authorization"];
  }

  getRedactKeys() {
    return [];
  }

  abstract getIdentifier(): Promise<string>;

  abstract subscribe(props: any): Promise<void>;

  /**
   * @internal
   */
  async _subscribe(props: { filter: string }) {
    const { filter } = props;

    const envName = getEnvName();
    const { webhookName } = getContext();

    if (!webhookName) {
      throw new Error("Must be called in a webhook context");
    }

    const auth = this.getAuthData();

    const additionalData = auth.customAppName
      ? {
          customAppWebhook: {
            customAppName: auth.customAppName,
            identifier: await this.getIdentifier(),
            filter,
          },
        }
      : { appWebhook: { appName: auth.appName, filter } };

    const response = await baseRequest({
      method: "PATCH",
      uri: `/api/v1/projects/default/envs/${envName}/webhooks/${webhookName}/subscription`,
      data: {
        ...additionalData,
      },
    });

    console.debug("response", {
      status: response.status,
      statusText: response.statusText,
      data: await response.json(),
    });
  }

  async unsubscribe() {
    const envName = getEnvName();
    const { webhookName } = getContext();

    if (!webhookName) {
      throw new Error("Must be called in a webhook context");
    }

    return await baseRequest({
      method: "PATCH",
      uri: `/api/v1/projects/default/envs/${envName}/webhooks/${webhookName}/subscription`,
      data: {
        appWebhook: null,
        customAppWebhook: null,
      },
    });
  }

  async validateDelivery(delivery: WebhookDelivery) {
    return true;
  }

  async receiveDelivery(
    delivery: WebhookDelivery
  ): Promise<AppWebhookDeliveryResponse> {
    console.debug("XXX Received delivery", delivery);
    console.log("variables", this.variables);
    console.log("secrets", this.secrets);

    const validated = await this.validateDelivery(delivery);
    if (!validated) {
      return {
        response: {
          statusCode: 401,
        },
        forward: null,
      };
    }

    return {
      response: {
        statusCode: 200,
      },
      forward: null,
    };
  }
}
