import { BuiltInApp } from './app-types';

/**
 * Built-in apps provided by Unscrambled
 * These are pre-configured and ready to use
 */

// Type-safe built-in app references
export const BuiltInApps = {
  SALESFORCE: {
    name: 'salesforce',
    title: 'Salesforce',
    authorizationType: 'OAUTH2'
  },
  HUBSPOT: {
    name: 'hubspot',
    title: 'HubSpot',
    authorizationType: 'OAUTH2'
  },
  STRIPE: {
    name: 'stripe',
    title: 'Stripe',
    authorizationType: 'APIKEY'
  },
  SHOPIFY: {
    name: 'shopify',
    title: 'Shopify',
    authorizationType: 'OAUTH2'
  },
  SLACK: {
    name: 'slack',
    title: 'Slack',
    authorizationType: 'OAUTH2'
  },
  GITHUB: {
    name: 'github',
    title: 'GitHub',
    authorizationType: 'OAUTH2'
  },
  GOOGLE_SHEETS: {
    name: 'google_sheets',
    title: 'Google Sheets',
    authorizationType: 'OAUTH2'
  },
  SENDGRID: {
    name: 'sendgrid',
    title: 'SendGrid',
    authorizationType: 'APIKEY'
  },
  TWILIO: {
    name: 'twilio',
    title: 'Twilio',
    authorizationType: 'BASIC'
  },
  MAILCHIMP: {
    name: 'mailchimp',
    title: 'Mailchimp',
    authorizationType: 'OAUTH2'
  }
} as const satisfies Record<string, BuiltInApp>;

// Type for any built-in app name
export type BuiltInAppName = typeof BuiltInApps[keyof typeof BuiltInApps]['name'];

// Helper function to reference a built-in app
export function useBuiltInApp(app: BuiltInApp): BuiltInApp {
  return app;
}