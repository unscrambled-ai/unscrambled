import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";

const HubSpotContactSchema = z.object({
  id: z.string(),
  properties: z.object({
    createdate: z.string(),
    email: z.string().nullable(),
    firstname: z.string().nullable(),
    lastname: z.string().nullable(),
    jobtitle: z.string().nullable(),
    phone: z.string().nullable(),
    mobilephone: z.string().nullable(),
    address: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    zip: z.string().nullable(),
    country: z.string().nullable(),
    associatedcompanyid: z.string().nullable(),
    hubspot_owner_id: z.string().nullable(),
    hs_lastmodifieddate: z.string(),
    hs_object_id: z.string(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean(),
});

const HubSpotContactListResponseSchema = z.object({
  results: z.array(HubSpotContactSchema),
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

export const contactModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector
    .withList({
      request: (props) => ({
        endpoint: "/objects/contacts",
        method: "GET",
        params: {
          limit: 100,
          after: props.cursor,
          properties: [
            "firstname",
            "lastname",
            "jobtitle",
            "email",
            "phone",
            "mobilephone",
            "address",
            "city",
            "state",
            "zip",
            "country",
            "associatedcompanyid",
            "hubspot_owner_id",
          ].join(","),
        },
      }),
      responseSchema: HubSpotContactListResponseSchema,
      pagination: ({ response }) => ({
        cursor: response.paging?.next?.after,
        hasMore: !!response.paging?.next?.after,
      }),
      transform: (response) =>
        response.results.map((result) => ({
          externalId: result.id,
          externalUpdatedAt: result.updatedAt,
          data: {
            firstName: result.properties.firstname,
            lastName: result.properties.lastname,
            email: result.properties.email,
            title: result.properties.jobtitle,
            phone: result.properties.phone,
            mobile: result.properties.mobilephone,
            address: {
              street: result.properties.address,
              city: result.properties.city,
              state: result.properties.state,
              postalCode: result.properties.zip,
              country: result.properties.country,
            },
            accountId:
              result.properties.associatedcompanyid === ""
                ? null
                : result.properties.associatedcompanyid,
            ownerId:
              result.properties.hubspot_owner_id === ""
                ? null
                : result.properties.hubspot_owner_id,
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
            jobtitle: obj.title,
            phone: obj.phone,
            mobilephone: obj.mobile,
            address: obj.address?.street,
            city: obj.address?.city,
            state: obj.address?.state,
            zip: obj.address?.postalCode,
            country: obj.address?.country,
            associatedcompanyid: obj.accountId,
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
        endpoint: `/objects/contacts/${externalId}`,
        method: "PATCH",
        json: {
          properties: {
            firstname: obj.firstName,
            lastname: obj.lastName,
            email: obj.email,
            jobtitle: obj.title,
            phone: obj.phone,
            mobilephone: obj.mobile,
            address: obj.address?.street,
            city: obj.address?.city,
            state: obj.address?.state,
            zip: obj.address?.postalCode,
            country: obj.address?.country,
            associatedcompanyid: obj.accountId,
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
        endpoint: `/objects/contacts/${externalId}`,
        method: "DELETE",
      }),
    });
