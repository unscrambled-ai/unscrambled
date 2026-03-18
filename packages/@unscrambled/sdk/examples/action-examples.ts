/**
 * Action Examples
 *
 * Various examples showing how to define actions with different configurations
 */

import { defineAction } from "../src";

/**
 * Define an action with a name
 */

const simpleAction = defineAction("send-notification").deploy();

/**
 * Define an action with a name and a title
 */

const titledAction = defineAction("sync-data")
  .withTitle("Synchronize Data")
  .deploy();

/**
 * Define an action with a name, title, and a secret
 */

const secretAction = defineAction("send-email")
  .withTitle("Send Email Notification")
  .addSecret("smtp_password", {
    title: "SMTP Password",
    description: "Password for SMTP authentication",
    required: true,
  })
  .deploy();

/**
 * Define an action with a name, title, and a secret and a variable
 */

const configuredAction = defineAction("process-payment")
  .withTitle("Process Payment")
  .addSecret("stripe_api_key", {
    title: "Stripe API Key",
    description: "Secret key for Stripe API",
    required: true,
  })
  .addVariable("payment_currency", {
    title: "Payment Currency",
    description: "Currency code for payments (e.g., USD, EUR)",
    defaultValue: "USD",
    required: false,
  })
  .deploy();

/**
 * Define an action with a name, title, and multiple variables and multiple secrets
 */

const multiConfigAction = defineAction("data-sync")
  .withTitle("Advanced Data Synchronization")
  .addSecret("source_api_key", {
    title: "Source API Key",
    description: "API key for source system",
    required: true,
  })
  .addSecret("dest_api_key", {
    title: "Destination API Key",
    description: "API key for destination system",
    required: true,
  })
  .addSecret("encryption_key", {
    title: "Encryption Key",
    description: "Key for encrypting data in transit",
    required: false,
  })
  .addVariable("sync_mode", {
    title: "Sync Mode",
    description: "Full or incremental sync",
    defaultValue: "incremental",
    required: true,
  })
  .addVariable("batch_size", {
    title: "Batch Size",
    description: "Number of records per batch",
    defaultValue: "100",
    required: false,
  })
  .addVariable("start_date", {
    title: "Start Date",
    description: "Date to start syncing from (YYYY-MM-DD)",
    required: false,
  })
  .deploy();

/**
 * Define a duplicate action from an instantiated action
 */

const duplicateAction = defineAction
  .from(multiConfigAction)
  .withName("data-sync-v2")
  .withTitle("Advanced Data Synchronization v2")
  .deploy();

// Export examples for reference
export {
  simpleAction,
  titledAction,
  secretAction,
  configuredAction,
  multiConfigAction,
  duplicateAction,
};
