# Establishing the new SDK

I am building an integration platform where users can sync data between products using custom code they have written against our APIs using an SDK that we need to define. We will start with a Typescript SDK and it needs to be flexible, extensible, easy to understand, and provide as much type safety as possible.

This will be to replace the existing sdk, which is currently in the packages directory lightyear. We can ignore this directory for now, although we will refer to it later.

I want you to first create the package called '@unscrambled/sdk' and give it some basic structure similar to the other packages.

After that, you'll notice I worked with you for a while and the exploration we did is contained in the directory .exploration

When a user creates a project with this SDK, it will be able to create a number of data structures in memory based on what the developer defines. When the environment it's running has the deploy function called, it will make api calls to deploy those things.

In the .exploration directory, you can see we discussed a number of things. Let's start with something relatively simple and just handle the definition of a collection.

We want to follow the builder pattern like we have in the .exploration directory and make it so the developer can define a collection.

Some things to consider:

- Some things will need to be deployed to the project, some will just exist in memory and be executed.
- Things to be deployed:
  - Custom apps
  - Integrations
  - Connectors
  - Collections
  - Actions
  - Webhooks
- Things that are deployed, but cannot exist independently:
  - Models (exist only on collections)
  - Variables (exist on custom apps, actions, and webhooks)
  - Secrets (exist on custom apps, actions, and webhooks)
- Things that will just exist in memory and be executed:
  - RestConnectors
  - OAuthConnectors
  - SyncConnectors (do not have names or titles and aren't deployed as objects)
- Things that will just exist in memory and be executed, but cannot exist independently:
  - ModelConnectors (do not have names or titles and aren't deployed as objects)

For artifacts that will be deployed and can exist independently, let's use the builder pattern and let's call the initial function defineXXX, where XXX is the name of the artifact. At the end of the builder, we will call the deploy function. These generally need a name and a title.

For artifacts that will just exist in memory and be executed, let's use the builder pattern and let's call the initial function createXXX, where XXX is the name of the artifact. At the end of the builder, we will call the build function. These do not need a name or a title.

For things that are deployed, but cannot exist independently, we will use the builder pattern and call the initial function defineXXX, where XXX is the name of the artifact along with an initial parameter that is the thing it depends on. At the end of the builder, we will call the deploy function. These generally need a name and a title.

For the rest connectors, when defining headers, there is a special syntax we can use for auth secrets. To specify an authorization header, the value can be 'Bearer {{ accessToken }}'. Other substitutions available are:

- apiKey
- username
- password

For sync connectors, most will have a set of model connectors that correspond to the models on the collection. We will use the builder pattern to define the sync connector and then use the .with method to add the model connectors.

In the example-templates directory, I have a number of example templates (named like action-examples-template.md, collection-examples-template.md, etc.) that show how to use the SDK. I want you to create a directory in @unscrambled/sdk/examples that contains these templates populated with the examples you create. Important:

- Only create the examples that are listed, do not create your own additional examples.
- Each heading in the template (e.g., "## Define an action with a name") should have a corresponding code example in the implementation file.
- Use the exact same headings from the templates as comments in the TypeScript files to delineate each example.
- Use JSDoc style comments (/\*\* \*/) for the example headings, formatted as:
  ```
  /**
   * Define an action with a name
   */
  ```
- When creating the actual example files, name them without the "-template" suffix (e.g., action-examples.ts, collection-examples.ts, etc.)

## Additional SDK Design Priorities for Sync Connectors

- We are trying to define an SDK to support syncing data between external apps and a typed collection.
- We want this SDK to be economical in how much it requires of the developer. Simple things should be simple, but complex things should be possible.
- We want everything to be as strongly typed as possible and that the developer should not have to define the same thing multiple times.
- We want to continue to leverage the fluid builder pattern
- We should initialize with the rest connector and the collection.
- The rest connector should validate the list responses with a Zod schema
- We should use json-schema-to-to to infer the types of the schemas for models on a collection
- We should be able to infer types from the rest connector and the collection to set the parameters of the .with and .add methods.
- Sync connectors don't have names or titles and aren't deployed as objects like collections and actions.
- We should be able to add model connectors that correspond with models in the collection.
- We should notify the developer of an error if they try to add model connectors that don't exist on the collection. Ideally this is a typescript error as well as a runtime error.
- The developer should be able to extend both the collection and the sync connector and if necessary the rest connector to add additional models.
- The developer should be able to leverage bulk create, update, and delete api calls if the app supports these.
- The list method should support various forms of paging, including cursor based and page based.
- The developer should be able to alter a model on an existing collection and the behavior of the corresponding model connector.
- The sync connector must provide a way to transform the list item response into a list of objects that conform to the collection's relevant model.
- Do not resort to as any in anything facing the developer. We need to make this super typesafe.
