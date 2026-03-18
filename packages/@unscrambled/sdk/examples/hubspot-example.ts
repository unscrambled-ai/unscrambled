import {
  createOAuthConnector,
  createRestConnector,
  defineCustomApp,
  defineCrmCollection,
  defineAction,
  defineIntegration,
  createSyncConnector,
} from "@unscrambled/sdk";
import z from "zod";

const crmCollection = defineCrmCollection()
  .withOnlyModels("user", "account", "contact")
  .deploy();

const hubspotOAuthConnector = createOAuthConnector()
  .withAuthUrl("https://app.hubspot.com/oauth/authorize")
  .withTokenUrl("https://api.hubapi.com/oauth/v1/token")
  .withScope([
    "crm.objects.companies.read",
    "crm.objects.companies.write",
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
    "crm.objects.deals.read",
    "crm.objects.deals.write",
    "crm.objects.owners.read",
    "crm.objects.users.read",
    "oauth",
  ])
  .build();

const hubspotCustomApp = defineCustomApp("hubspot", "OAUTH2")
  .withTitle("HubSpot")
  .withOAuthConnector(hubspotOAuthConnector)
  .addVariable("appId")
  .deploy();

const hubspotRestConnector = createRestConnector()
  .withBaseUrl("https://api.hubspot.com/crm/v3")
  .addHeader("Authorization", "Bearer {{ accessToken }}")
  .build();

const hubspotSyncConnector = createSyncConnector(
  hubspotRestConnector,
  crmCollection
)
  .withModelConnector("user", (modelConnector) =>
    modelConnector.withList({
      request: (props) => ({
        endpoint: "/owners",
        method: "GET",
      }),
      responseSchema: z.object({
        results: z.array(
          z.object({
            id: z.string(),
            email: z.string(),
            type: z.string(),
            firstName: z.string(),
            lastName: z.string(),
            userId: z.number(),
            userIdIncludingInactive: z.number(),
            createdAt: z.string(),
            updatedAt: z.string(),
            archived: z.boolean(),
          })
        ),
      }),
      transform: (response) =>
        response.results.map((result) => ({
          externalId: result.id,
          externalUpdatedAt: result.updatedAt,
          data: {
            firstName: result.firstName,
            lastName: result.lastName,
            email: result.email,
            username: result.userId.toString(),
          },
        })),
    })
  )
  .withModelConnector("account", (modelConnector) =>
    modelConnector
      .withList({
        request: (props) => ({
          endpoint: "/objects/companies",
          method: "GET",
          params: {
            limit: 100,
            after: props.cursor,
          },
        }),
        responseSchema: z.object({
          results: z.array(
            z.object({
              id: z.string(),
              properties: z.object({
                createdate: z.string(),
                domain: z.string().nullable(),
                hs_lastmodifieddate: z.string(),
                hs_object_id: z.string(),
                name: z.string().nullable(),
              }),
              createdAt: z.string(),
              updatedAt: z.string(),
              archived: z.boolean(),
            })
          ),
        }),
        transform: (response) =>
          response.results.map((result) => ({
            externalId: result.id,
            externalUpdatedAt: result.updatedAt,
            data: {
              name: result.properties.name,
            },
          })),
      })
      .withCreate({
        request: (obj) => ({
          endpoint: "/objects/companies",
          method: "POST",
          json: {
            properties: {
              name: obj.name,
            },
          },
        }),
        responseSchema: z.object({
          id: z.string(),
          updatedAt: z.string(),
        }),
        extract: (response) => ({
          externalId: response.id,
          externalUpdatedAt: response.updatedAt,
        }),
      })
      .withUpdate({
        request: (externalId, obj) => ({
          endpoint: `/objects/companies/${externalId}`,
          method: "PATCH",
          json: {
            properties: {
              name: obj.name,
            },
          },
        }),
        responseSchema: z.object({
          id: z.string(),
          updatedAt: z.string(),
        }),
        extract: (response) => ({
          externalId: response.id,
          externalUpdatedAt: response.updatedAt,
        }),
      })
      .withDelete({
        request: (externalId) => ({
          endpoint: `/objects/companies/${externalId}`,
          method: "DELETE",
        }),
      })
  )
  .withModelConnector("contact", (modelConnector) =>
    modelConnector
      .withList({
        request: (props) => ({
          endpoint: "/objects/contacts",
          method: "GET",
          params: {
            limit: 100,
            after: props.cursor,
          },
        }),
        responseSchema: z.object({
          results: z.array(
            z.object({
              id: z.string(),
              properties: z.object({
                createdate: z.string(),
                email: z.string().nullable(),
                firstname: z.string().nullable(),
                hs_object_id: z.string(),
                lastmodifieddate: z.string(),
                lastname: z.string().nullable(),
              }),
              createdAt: z.string(),
              updatedAt: z.string(),
              archived: z.boolean(),
            })
          ),
        }),
        transform: (response) =>
          response.results.map((result) => ({
            externalId: result.id,
            externalUpdatedAt: result.updatedAt,
            data: {
              firstName: result.properties.firstname,
              lastName: result.properties.lastname,
              email: result.properties.email,
            },
          })),
      })
      .withCreate({
        request: (obj) => ({
          endpoint: "/objects/contacts",
          method: "POST",
          json: {
            properties: {
              firstname: obj.firstName,
              lastname: obj.lastName,
              email: obj.email,
            },
          },
        }),
        responseSchema: z.object({
          id: z.string(),
          updatedAt: z.string(),
        }),
        extract: (response) => ({
          externalId: response.id,
          externalUpdatedAt: response.updatedAt,
        }),
      })
      .withUpdate({
        request: (externalId, obj) => ({
          endpoint: `/objects/contacts/${externalId}`,
          method: "PATCH",
          json: {
            properties: {
              firstname: obj.firstName,
              lastname: obj.lastName,
              email: obj.email,
            },
          },
        }),
        responseSchema: z.object({
          id: z.string(),
          updatedAt: z.string(),
        }),
        extract: (response) => ({
          externalId: response.id,
          externalUpdatedAt: response.updatedAt,
        }),
      })
      .withDelete({
        request: (externalId) => ({
          endpoint: `/objects/contacts/${externalId}`,
          method: "DELETE",
        }),
      })
  )
  .build();

defineIntegration("hubspot-crm")
  .withTitle("HubSpot CRM")
  .withCustomApp(hubspotCustomApp)
  .withCollection(hubspotCollection)
  .withActions(
    defineAction("hubspot-get-users")
      .withRun(async () => {
        await hubspotRestConnector.get({
          url: "owners",
        });
      })
      .deploy(),
    defineAction("hubspot-get-companies")
      .withRun(async () => {
        await hubspotRestConnector.get({
          url: "objects/companies",
        });
      })
      .deploy(),
    defineAction("hubspot-get-contacts")
      .withRun(async () => {
        await hubspotRestConnector.get({
          url: "objects/contacts",
        });
      })
      .deploy(),
    defineAction("hubspot-create-contact")
      .withRun(async () => {
        await hubspotRestConnector.post({
          url: "objects/contacts",
          json: {
            properties: {
              firstname: "John",
              lastname: "Doe",
              email: "john.doe@example.com",
            },
          },
        });
      })
      .deploy(),
    defineAction("hubspot-full-sync")
      .withRun(async () => {
        await hubspotSyncConnector.sync();
      })
      .deploy()
  )
  .deploy();
