import {
  createSyncConnector,
  RestConnector,
  Collection,
} from "@unscrambled/sdk";
import { userModelConnector } from "./models/user";
import { accountModelConnector } from "./models/account";
import { contactModelConnector } from "./models/contact";
import { opportunityModelConnector } from "./models/opportunity";
import { leadModelConnector } from "./models/lead";
import { callModelConnector } from "./models/call";
import { taskModelConnector } from "./models/task";
import { meetingModelConnector } from "./models/meeting";
import { noteModelConnector } from "./models/note";
import { productModelConnector } from "./models/product";
import { opportunityLineItemModelConnector } from "./models/opportunityLineItem";

// Placeholder: Wire model connectors when Salesforce model builders are available
export function createSalesforceSyncConnector(
  restConnector: RestConnector,
  collection: Collection
) {
  return createSyncConnector(restConnector, collection)
    .withModelConnector("user", userModelConnector)
    .withModelConnector("account", accountModelConnector)
    .withModelConnector("contact", contactModelConnector)
    .withModelConnector("opportunity", opportunityModelConnector)
    .withModelConnector("lead", leadModelConnector)
    .withModelConnector("call", callModelConnector)
    .withModelConnector("task", taskModelConnector)
    .withModelConnector("meeting", meetingModelConnector)
    .withModelConnector("note", noteModelConnector)
    .withModelConnector("product", productModelConnector)
    .withModelConnector(
      "opportunityLineItem",
      opportunityLineItemModelConnector
    );
}
