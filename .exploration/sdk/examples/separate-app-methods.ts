import { defineIntegration } from '../integration-builder-v3';
import { defineCollection } from '../builders';
import { defineCustomApp, defineOAuth2App } from '../app-builder';

/**
 * Examples using separate methods for built-in vs custom apps
 */

// Using a built-in app - clear and simple
const salesforceIntegration = defineIntegration()
  .withApp('salesforce') // Built-in app by name
  .withCollections({
    contacts: defineCollection('contacts')
      .addModel('contact', {
        matchPattern: 'email'
      })
      .build()
  })
  .build();

// Using a custom app - explicit and type-safe
const myCustomApp = defineCustomApp('salesforce', 'OAUTH2') // Can safely use same name!
  .withTitle('Our Custom Salesforce Integration')
  .withVariables('clientId', 'subdomain')
  .withSecrets('clientSecret')
  .build();

const customIntegration = defineIntegration()
  .withCustomApp(myCustomApp) // Clearly a custom app
  .withCollections({
    contacts: defineCollection('contacts')
      .addModel('contact', {
        matchPattern: 'email'
      })
      .build()
  })
  .build();

// No ambiguity - the platform knows:
// - salesforceIntegration uses the built-in Salesforce app
// - customIntegration uses a custom app that happens to be named 'salesforce'

// More examples
const hubspotIntegration = defineIntegration()
  .withApp('hubspot') // Built-in
  .withCollections({
    contacts: defineCollection('contacts').build(),
    companies: defineCollection('companies').build()
  })
  .build();

const customCrmApp = defineOAuth2App('custom_crm')
  .withTitle('Internal CRM System')
  .build();

const customCrmIntegration = defineIntegration()
  .withCustomApp(customCrmApp) // Custom
  .withCollections({
    accounts: defineCollection('accounts').build()
  })
  .build();

// Future-proof: If Unscrambled releases a 'custom_crm' built-in app later,
// existing integrations using withCustomApp won't break
const futureBuiltIn = defineIntegration()
  .withApp('custom_crm') // Would use the new built-in app
  .build();

// Benefits:
// 1. No naming conflicts between built-in and custom apps
// 2. Clear intent in the code
// 3. Type safety - withCustomApp requires a CustomApp object
// 4. Future-proof - new built-in apps won't break existing custom apps