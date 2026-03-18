export type HubSpotScope =
  | "crm.objects.users.read"
  /**
   * Integrators can list CMS domains in a customer's account.
   */
  | "cms.domains.read"
  /**
   * Integrators can create, update, and delete CMS custom domains.
   */
  | "cms.domains.write"
  /**
   * Integrators can view all CMS serverless functions, any related secrets, and function execution results.
   */
  | "cms.functions.read"
  /**
   * Integrators can write CMS serverless functions and secrets.
   */
  | "cms.functions.write"
  /**
   * View details about knowledge articles.
   */
  | "cms.knowledge_base.articles.read"
  /**
   * Grants access to update knowledge articles.
   */
  | "cms.knowledge_base.articles.write"
  /**
   * Grants access to update and publish knowledge articles.
   */
  | "cms.knowledge_base.articles.publish"
  /**
   * View general and template knowledge base settings, such as the domain or root URL.
   */
  | "cms.knowledge_base.settings.read"
  /**
   * Grants access to update general and template knowledge base settings. This includes write access to knowledge articles.
   */
  | "cms.knowledge_base.settings.write"
  /**
   * Integrators can view CMS performance data for all your sites.
   */
  | "cms.performance.read"
  /**
   * View details about contact lists.
   */
  | "crm.lists.read"
  /**
   * Create, delete, or make changes to contact lists
   */
  | "crm.lists.write"
  /**
   * View properties and other details about companies.
   */
  | "crm.objects.companies.read"
  /**
   * View properties and create, delete, or make changes to companies.
   */
  | "crm.objects.companies.write"
  /**
   * View properties and other details about contacts.
   */
  | "crm.objects.contacts.read"
  /**
   * View properties and create, delete, and make changes to contacts.
   */
  | "crm.objects.contacts.write"
  /**
   * View details about custom objects in the HubSpot CRM.
   */
  | "crm.objects.custom.read"
  /**
   * Create, delete, or make changes to custom objects in the HubSpot CRM.
   */
  | "crm.objects.custom.write"
  /**
   * View properties and other details about deals.
   */
  | "crm.objects.deals.read"
  /**
   * View properties and create, delete, or make changes to deals.
   */
  | "crm.objects.deals.write"
  /**
   * View details about submissions to any of your feedback surveys.
   */
  | "crm.objects.feedback_submission.read"
  /**
   * View all goal types.
   */
  | "crm.objects.goals.read"
  /**
   * View properties and other details about line items
   */
  | "crm.objects.line_items.read"
  /**
   * Create, delete, or make changes to line items.
   */
  | "crm.objects.line_items.write"
  /**
   * View details about marketing events.
   */
  | "crm.objects.marketing_events.read"
  /**
   * Create, delete, or make changes to marketing events.
   */
  | "crm.objects.marketing_events.write"
  /**
   * View details about users assigned to a CRM record.
   */
  | "crm.objects.owners.read"
  /**
   * View properties and other details about quotes and quote templates.
   */
  | "crm.objects.quotes.read"
  /**
   * Create, delete, or make changes to quotes.
   */
  | "crm.objects.quotes.write"
  /**
   * View details about property settings for companies
   */
  | "crm.schemas.companies.read"
  /**
   * Create, delete, or make changes to property settings for companies.
   */
  | "crm.schemas.companies.write"
  /**
   * View details about property settings for contacts.
   */
  | "crm.schemas.contacts.read"
  /**
   * Create, delete, or make changes to property settings for contacts.
   */
  | "crm.schemas.contacts.write"
  /**
   * View details about custom object definitions in the HubSpot CRM.
   */
  | "crm.schemas.custom.read"
  /**
   * View details about property settings for deals.
   */
  | "crm.schemas.deals.read"
  /**
   * Create, delete, or make changes to property settings for deals.
   */
  | "crm.schemas.deals.write"
  /**
   * View details about line items.
   */
  | "crm.schemas.line_items.read"
  /**
   * View details about quotes and quotes templates.
   */
  | "crm.schemas.quotes.read"
  /**
   * Make changes to your account's billing settings. This includes managing and assigning paid seats for users.
   */
  | "settings.billing.write"
  /**
   * Reads existing exchange rates along with the current company currency associated with your portal.
   */
  | "settings.currencies.read"
  /**
   * Create, update and delete exchange rates along with updating the company currency associated with your portal.
   */
  | "settings.currencies.write"
  /**
   * View details about account users and their permissions.
   */
  | "settings.users.read"
  /**
   * Manage users and user permissions on your HubSpot account. This includes creating new users, assigning permissions and roles, and deleting existing users.
   */
  | "settings.users.write"
  /**
   * See details about the account's teams.
   */
  | "settings.users.teams.read"
  /**
   * Assign users to teams on your HubSpot account.
   */
  | "settings.users.team.write"
  /**
   * Includes access to account activity logs and other account security information.
   */
  | "account-info.security.read"
  /**
   * Allows HubSpot and the accounting integration to share invoice, product, and contact details.
   */
  | "accounting"
  /**
   * Add forms to the contact's pages that do custom actions.
   */
  | "actions"
  /**
   * Includes access to send custom behavioral events.
   */
  | "analytics.behavioral_events.send"
  /**
   * This includes workflows.
   */
  | "automation"
  /**
   * Create, read, update, or delete behavioral events. This includes behavioral event properties.
   */
  | "behavioral_events.event_definitions.read_write"
  /**
   * Integrators can view CMS domains in a customer's account.
   */
  | "business_units.view.read"
  /**
   * This includes endpoints that sit on top of sources and email.
   */
  | "business-intelligence"
  /**
   * Query data from your HubSpot account using the GraphQL API endpoint
   */
  | "collector.graphql_query.execute"
  /**
   * Perform introspection queries via GraphQL application clients such as GraphQL
   */
  | "collector.graphql_schema.read"
  /**
   * View details of your contacts' subscription preferences.
   */
  | "communication_preferences.read"
  /**
   * Subscribe/unsubscribe contacts to your subscription types. It won't subscribe contacts who have unsubscribed.
   */
  | "communication_preferences.read_write"
  /**
   * Subscribe/unsubscribe contacts to your subscription types. It won't subscribe contacts who have unsubscribed.
   */
  | "communication_preferences.write"
  /**
   * This includes access to File Manager.
   */
  | "content"
  /**
   * View details about threads in the conversations inbox.
   */
  | "conversations.read"
  /**
   * Fetch identification tokens for authenticated website visitors interacting with the HubSpot chat widget.
   */
  | "conversations.visitor_identification.tokens.create"
  /**
   * Send messages in conversations. Create and update message threads.
   */
  | "conversations.write"
  /**
   * Export records from your CRM for all CRM data types.
   */
  | "crm.export"
  /**
   * Allows you to import records into your CRM. This includes creating new records or modifying any of your existing records for all CRM data types (contacts, companies, deals, tickets, etc). It doesn't include archiving or deleting any data.
   */
  | "crm.import"
  /**
   * Allows read access for CTAs.
   */
  | "ctas.read"
  /**
   * This includes access to e-commerce features.
   */
  | "e-commerce"
  /**
   * Includes the ability to rename, delete, and clone existing forms.
   */
  | "external_integrations.forms.access"
  /**
   * This includes access to File Manager.
   */
  | "files"
  /**
   * View details or download user files, attachments, and system files from all HubSpot tools.
   */
  | "files.ui_hidden.read"
  /**
   * This includes access to the Forms endpoints.
   */
  | "forms"
  /**
   * Download files submitted through a form.
   */
  | "forms-uploaded-files"
  /**
   * This includes access to HubDB.
   */
  | "hubdb"
  /**
   * This exposes the sync API, which allows syncing of most CRM objects.
   */
  | "integration-sync"
  /**
   * Grants access to events and objects from the media bridge.
   */
  | "media_bridge.read"
  /**
   * Grants access to create and update events and objects from the media bridge.
   */
  | "media_bridge.write"
  /**
   * Basic scope required for OAuth. This scope is added by default to all apps.
   */
  | "oauth"
  /**
   * Grants access to read all details of one-to-one emails sent to contacts.
   */
  | "sales-email-read"
  /**
   * This includes Social Inbox.
   */
  | "social"
  /**
   * This includes access to tickets.
   */
  | "tickets"
  /**
   * Grants access to manage custom events on HubSpot CRM records. This includes creating or updating records.
   */
  | "timeline"
  /**
   * This includes transactional emails and the transactional emails endpoints.
   */
  | "transactional-email";

/**
 * All HubSpot OAuth scopes supported by the HubSpot connector
 */
export const HUBSPOT_SCOPES: readonly HubSpotScope[] = [
  "crm.objects.users.read",
  "cms.domains.read",
  "cms.domains.write",
  "cms.functions.read",
  "cms.functions.write",
  "cms.knowledge_base.articles.read",
  "cms.knowledge_base.articles.write",
  "cms.knowledge_base.articles.publish",
  "cms.knowledge_base.settings.read",
  "cms.knowledge_base.settings.write",
  "cms.performance.read",
  "crm.lists.read",
  "crm.lists.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.custom.read",
  "crm.objects.custom.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.objects.feedback_submission.read",
  "crm.objects.goals.read",
  "crm.objects.line_items.read",
  "crm.objects.line_items.write",
  "crm.objects.marketing_events.read",
  "crm.objects.marketing_events.write",
  "crm.objects.owners.read",
  "crm.objects.quotes.read",
  "crm.objects.quotes.write",
  "crm.schemas.companies.read",
  "crm.schemas.companies.write",
  "crm.schemas.contacts.read",
  "crm.schemas.contacts.write",
  "crm.schemas.custom.read",
  "crm.schemas.deals.read",
  "crm.schemas.deals.write",
  "crm.schemas.line_items.read",
  "crm.schemas.quotes.read",
  "settings.billing.write",
  "settings.currencies.read",
  "settings.currencies.write",
  "settings.users.read",
  "settings.users.write",
  "settings.users.teams.read",
  "settings.users.team.write",
  "account-info.security.read",
  "accounting",
  "actions",
  "analytics.behavioral_events.send",
  "automation",
  "behavioral_events.event_definitions.read_write",
  "business_units.view.read",
  "business-intelligence",
  "collector.graphql_query.execute",
  "collector.graphql_schema.read",
  "communication_preferences.read",
  "communication_preferences.read_write",
  "communication_preferences.write",
  "content",
  "conversations.read",
  "conversations.visitor_identification.tokens.create",
  "conversations.write",
  "crm.export",
  "crm.import",
  "ctas.read",
  "e-commerce",
  "external_integrations.forms.access",
  "files",
  "files.ui_hidden.read",
  "forms",
  "forms-uploaded-files",
  "hubdb",
  "integration-sync",
  "media_bridge.read",
  "media_bridge.write",
  "oauth",
  "sales-email-read",
  "social",
  "tickets",
  "timeline",
  "transactional-email",
];
