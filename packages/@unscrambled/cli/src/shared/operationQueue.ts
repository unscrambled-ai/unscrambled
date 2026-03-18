import runAction, { RunActionProps } from "./runAction";
import execResubscribe, { ExecResubscribeProps } from "./execResubscribe";
import invariant from "tiny-invariant";
import execDeployAndSubscribe from "./execDeployAndSubscribe";
import {
  execGetAuthRequestUrl,
  ExecGetAuthRequestUrlProps,
} from "./execGetAuthRequestUrl";
import {
  execRequestAccessToken,
  ExecRequestAccessTokenProps,
} from "./execRequestAccessToken";
import {
  execRefreshAccessToken,
  ExecRefreshAccessTokenProps,
} from "./execRefreshAccessToken";
import {
  execRefreshSubscription,
  ExecRefreshSubscriptionProps,
} from "./execRefreshSubscription";
import { terminal } from "terminal-kit";
import { handleReceiveCustomAppWebhook } from "../commands/dev/handleReceiveCustomAppWebhook";
import {
  execReceiveCustomWebhook,
  ExecReceiveCustomWebhookProps,
} from "./execReceiveCustomWebhook";

export interface OperationQueueDeployItem {
  operation: "deploy";
  params: { environment?: string } | undefined;
}

export interface OperationQueueRunItem {
  operation: "run";
  params: RunActionProps;
}

export interface OperationQueueRefreshSubscriptionItem {
  operation: "refreshSubscription";
  params: ExecRefreshSubscriptionProps;
}

export interface OperationQueueResubscribeItem {
  operation: "resubscribe";
  params: ExecResubscribeProps;
}

export interface OperationQueueGetAuthRequestUrlItem {
  operation: "getAuthRequestUrl";
  params: ExecGetAuthRequestUrlProps;
}

export interface OperationQueueRequestAccessTokenItem {
  operation: "requestAccessToken";
  params: ExecRequestAccessTokenProps;
}

export interface OperationQueueRefreshAccessTokenItem {
  operation: "refreshAccessToken";
  params: ExecRefreshAccessTokenProps;
}

export interface OperationQueueReceiveCustomAppWebhook {
  operation: "receiveCustomAppWebhook";
  params: ExecReceiveCustomWebhookProps;
}

export type OperationQueueItem =
  | OperationQueueDeployItem
  | OperationQueueGetAuthRequestUrlItem
  | OperationQueueRequestAccessTokenItem
  | OperationQueueRefreshAccessTokenItem
  | OperationQueueRefreshSubscriptionItem
  | OperationQueueReceiveCustomAppWebhook
  | OperationQueueRunItem
  | OperationQueueResubscribeItem;

export const operationQueue: Array<OperationQueueItem> = [];

let processingOperations = false;
let firstOperationsProcessed = true;
let queuePaused = false;

export function pauseOperationQueue() {
  queuePaused = true;
  console.debug("Operation queue paused");
}

export function resumeOperationQueue() {
  queuePaused = false;
  console.debug("Operation queue resumed");
  if (!processingOperations && operationQueue.length > 0) {
    processOperations();
  }
}

export function pushOperation(operationQueueItem: OperationQueueItem) {
  operationQueue.push(operationQueueItem);
  if (!processingOperations && !queuePaused) {
    processOperations();
  }
}

async function processOperations() {
  if (queuePaused) {
    console.debug("Operation queue is paused, skipping processing");
    return;
  }

  processingOperations = true;
  console.debug("Starting to process operations");
  while (operationQueue.length > 0 && !queuePaused) {
    const item = operationQueue.shift();
    invariant(item);

    console.info("Processing operation", item.operation);

    try {
      if (item.operation === "deploy") {
        await execDeployAndSubscribe(item.params?.environment);
      } else if (item.operation === "run") {
        await runAction(item.params);
      } else if (item.operation === "resubscribe") {
        await execResubscribe(item.params);
      } else if (item.operation === "getAuthRequestUrl") {
        await execGetAuthRequestUrl(item.params);
      } else if (item.operation === "requestAccessToken") {
        await execRequestAccessToken(item.params);
      } else if (item.operation === "refreshAccessToken") {
        await execRefreshAccessToken(item.params);
      } else if (item.operation === "refreshSubscription") {
        await execRefreshSubscription(item.params);
      } else if (item.operation === "receiveCustomAppWebhook") {
        await execReceiveCustomWebhook(item.params);
      } else {
        const _exhaustiveCheck: never = item;
        console.error(`Unhandled operation ${_exhaustiveCheck}`);
      }
    } catch (error) {
      console.error(`Error processing ${item.operation}:`, error);
    }
  }
  console.debug("Finished processing operations");
  processingOperations = false;

  if (firstOperationsProcessed) {
    terminal("\n\nDashboard is available at: https://app.runlightyear.com\n");
    firstOperationsProcessed = false;
  }

  terminal("\n\nWaiting for file changes...\n");
  terminal("press h for help, press q to quit\n\n");
}
