import {
  defineCrmCollection,
  defineIntegration,
  defineAction,
  SyncModelConnectorBuilder,
} from "@unscrambled/sdk";
import {
  defineHubSpotCustomApp,
  createHubSpotRestConnector,
  createHubSpotSyncConnector,
} from "../src";
import z from "zod";

// Define schemas for HubSpot products and line items
const HubSpotProductSchema = z.object({
  id: z.string(),
  properties: z.object({
    name: z.string().nullable(),
    description: z.string().nullable(),
    price: z.string().nullable(),
    hs_sku: z.string().nullable(),
    hs_lastmodifieddate: z.string(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean(),
});

const HubSpotProductListResponseSchema = z.object({
  results: z.array(HubSpotProductSchema),
  paging: z
    .object({
      next: z
        .object({
          after: z.string(),
        })
        .optional(),
    })
    .optional(),
});

// Create a custom product model connector
const productModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector
    .withList({
      request: (props) => ({
        endpoint: "/objects/products",
        method: "GET",
        params: {
          limit: 100,
          after: props.cursor,
          properties: ["name", "description", "price", "hs_sku"].join(","),
        },
      }),
      responseSchema: HubSpotProductListResponseSchema,
      pagination: (response) => ({
        cursor: response.paging?.next?.after,
      }),
      transform: (response) =>
        response.results.map((result) => ({
          externalId: result.id,
          externalUpdatedAt: result.updatedAt,
          data: {
            name: result.properties.name,
            description: result.properties.description,
            price: result.properties.price,
            code: result.properties.hs_sku,
          },
        })),
    })
    .withCreate({
      request: (obj) => ({
        endpoint: "/objects/products",
        method: "POST",
        json: {
          properties: {
            name: obj.name,
            description: obj.description,
            price: obj.price,
            hs_sku: obj.code,
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
        endpoint: `/objects/products/${externalId}`,
        method: "PATCH",
        json: {
          properties: {
            name: obj.name,
            description: obj.description,
            price: obj.price,
            hs_sku: obj.code,
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
        endpoint: `/objects/products/${externalId}`,
        method: "DELETE",
      }),
    });

// Create a collection with product model
const extendedCrmCollection = defineCrmCollection()
  .withOnlyModels("user", "account", "contact", "opportunity", "product")
  .deploy();

// Set up custom app with default OAuth connector
const hubspotCustomApp = defineHubSpotCustomApp().deploy();

const hubspotRestConnector = createHubSpotRestConnector();

// Create sync connector and add the product model
const hubspotSyncConnector = createHubSpotSyncConnector(
  hubspotRestConnector,
  extendedCrmCollection
)
  .withModelConnector("product", productModelConnector)
  .build();

// You can also override existing model connectors
const customContactConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector.withList({
    request: (props) => ({
      endpoint: "/objects/contacts",
      method: "GET",
      params: {
        limit: 50, // Different page size
        after: props.cursor,
        properties: ["firstname", "lastname", "email", "phone"].join(","),
      },
    }),
    responseSchema: z.object({
      results: z.array(
        z.object({
          id: z.string(),
          properties: z.object({
            firstname: z.string().nullable(),
            lastname: z.string().nullable(),
            email: z.string().nullable(),
            phone: z.string().nullable(),
            hs_lastmodifieddate: z.string(),
          }),
          updatedAt: z.string(),
        })
      ),
      paging: z
        .object({
          next: z
            .object({
              after: z.string(),
            })
            .optional(),
        })
        .optional(),
    }),
    pagination: (response) => ({
      cursor: response.paging?.next?.after,
    }),
    transform: (response) =>
      response.results.map((result) => ({
        externalId: result.id,
        externalUpdatedAt: result.updatedAt,
        data: {
          firstName: result.properties.firstname,
          lastName: result.properties.lastname,
          email: result.properties.email,
          phone: result.properties.phone,
        },
      })),
  });

// Override the contact connector
const customSyncConnector = createHubSpotSyncConnector(
  hubspotRestConnector,
  extendedCrmCollection
)
  .withModelConnector("contact", customContactConnector)
  .withModelConnector("product", productModelConnector)
  .build();

defineIntegration("hubspot-extended")
  .withTitle("HubSpot Extended")
  .withCustomApp(hubspotCustomApp)
  .withActions(
    defineAction("sync-with-products")
      .withRun(async () => {
        // This will sync all models including products
        await hubspotSyncConnector.sync();
      })
      .deploy()
  )
  .deploy();
