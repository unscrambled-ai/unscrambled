import {
  createSyncConnector,
  RestConnector,
  Collection,
} from "@unscrambled/sdk";
import {
  userModelConnector,
  accountModelConnector,
  contactModelConnector,
  opportunityModelConnector,
  taskModelConnector,
  meetingModelConnector,
  noteModelConnector,
  callModelConnector,
} from "./models";

export function createHubSpotSyncConnector(
  restConnector: RestConnector,
  collection: Collection
) {
  return createSyncConnector(restConnector, collection)
    .withModelConnector("user", userModelConnector)
    .withModelConnector("account", accountModelConnector)
    .withModelConnector("contact", contactModelConnector)
    .withModelConnector("opportunity", opportunityModelConnector)
    .withModelConnector("task", taskModelConnector)
    .withModelConnector("meeting", meetingModelConnector)
    .withModelConnector("note", noteModelConnector)
    .withModelConnector("call", callModelConnector);
}
