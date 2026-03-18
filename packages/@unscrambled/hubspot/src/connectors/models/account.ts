import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";

const HubSpotCompanySchema = z.object({
  id: z.string(),
  properties: z.object({
    createdate: z.string(),
    domain: z.string().nullable(),
    hs_lastmodifieddate: z.string(),
    hs_object_id: z.string(),
    name: z.string().nullable(),
    website: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable(),
    address2: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    zip: z.string().nullable(),
    country: z.string().nullable(),
    industry: z.string().nullable(),
    numberofemployees: z.string().nullable(),
    hubspot_owner_id: z.string().nullable(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean(),
});

const HubSpotCompanyListResponseSchema = z.object({
  results: z.array(HubSpotCompanySchema),
  paging: z
    .object({
      next: z
        .object({
          after: z.string(),
          link: z.string(),
        })
        .optional(),
    })
    .optional(),
});

export const accountModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector
    .withList({
      request: (props) => ({
        endpoint: "/objects/companies",
        method: "GET",
        params: {
          limit: 100,
          after: props.cursor,
          properties: [
            "name",
            "website",
            "phone",
            "address",
            "address2",
            "city",
            "state",
            "zip",
            "country",
            "industry",
            "numberofemployees",
            "hubspot_owner_id",
          ].join(","),
        },
      }),
      responseSchema: HubSpotCompanyListResponseSchema,
      pagination: ({ response }) => ({
        cursor: response.paging?.next?.after,
        hasMore: !!response.paging?.next?.after,
      }),
      transform: (response) =>
        response.results.map((result) => ({
          externalId: result.id,
          externalUpdatedAt: result.updatedAt,
          data: {
            name: result.properties.name,
            website: result.properties.website,
            phone: result.properties.phone,
            address: {
              street: result.properties.address,
              street2: result.properties.address2,
              city: result.properties.city,
              state: result.properties.state,
              postalCode: result.properties.zip,
              country: result.properties.country,
            },
            industry: result.properties.industry,
            numberOfEmployees: result.properties.numberofemployees,
            ownerId:
              result.properties.hubspot_owner_id === ""
                ? null
                : result.properties.hubspot_owner_id,
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
            website: obj.website,
            phone: obj.phone,
            address: obj.address?.street,
            address2: obj.address?.street2,
            city: obj.address?.city,
            state: obj.address?.state,
            zip: obj.address?.postalCode,
            country: obj.address?.country,
            industry: obj.industry,
            numberofemployees: obj.numberOfEmployees,
            hubspot_owner_id: obj.ownerId,
          },
        },
      }),
      responseSchema: z.object({
        id: z.string(),
        properties: z.object({
          hs_lastmodifieddate: z.string(),
        }),
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
            website: obj.website,
            phone: obj.phone,
            address: obj.address?.street,
            address2: obj.address?.street2,
            city: obj.address?.city,
            state: obj.address?.state,
            zip: obj.address?.postalCode,
            country: obj.address?.country,
            industry: obj.industry,
            numberofemployees: obj.numberOfEmployees,
            hubspot_owner_id: obj.ownerId,
          },
        },
      }),
      responseSchema: z.object({
        id: z.string(),
        properties: z.object({
          hs_lastmodifieddate: z.string(),
        }),
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
    });
