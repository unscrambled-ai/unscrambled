const { handler, getDeployList } = require("@unscrambled/sdk");

// Load your integration code (adjust the path if your app lives elsewhere)
require("./src");

// Export the handler for the deployment system to use
exports.handler = handler;
exports.getDeployList = getDeployList;

// Keep global assignment for compatibility
global.handler = handler;
global.getDeployList = getDeployList;

// The SDK has been updated to allow empty deployments
// You can add collections, models, integrations, etc. here later if needed
