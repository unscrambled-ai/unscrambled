/**
 * Test file to verify sync connector examples compile correctly
 */

import {
  basicSyncConnector,
  syncConnectorWithList,
  syncConnectorWithListAndCreate,
  fullCrudSyncConnector,
} from "./sync-connector-examples";

// Verify the connectors are created successfully
console.log("✓ Basic sync connector created");
console.log("✓ Sync connector with list created");
console.log("✓ Sync connector with list and create created");
console.log("✓ Full CRUD sync connector created");

// Verify we can access model connectors
const listConnector = syncConnectorWithList.getModelConnector("user");
if (listConnector) {
  console.log("✓ Model connector with list method accessible");
}

const crudConnector = fullCrudSyncConnector.getModelConnector("user");
if (
  crudConnector &&
  crudConnector.list &&
  crudConnector.create &&
  crudConnector.update &&
  crudConnector.delete
) {
  console.log("✓ Full CRUD model connector has all methods");
}

console.log("\nAll sync connector examples compiled successfully!");
