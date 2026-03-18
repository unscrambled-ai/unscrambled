import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";

const HubSpotDealSchema = z.object({
  id: z.string(),
  properties: z.object({
    dealname: z.string().nullable(),
    amount: z.string().nullable(),
    closedate: z.string().nullable(),
    dealstage: z.string().nullable(),
    hubspot_owner_id: z.string().nullable(),
    hs_lastmodifieddate: z.string(),
    hs_object_id: z.string(),
    createdate: z.string(),
  }),
  associations: z
    .object({
      companies: z
        .object({
          results: z.array(
            z.object({
              id: z.string(),
              type: z.string(),
            })
          ),
        })
        .optional(),
    })
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean(),
});

const HubSpotDealListResponseSchema = z.object({
  results: z.array(HubSpotDealSchema),
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

export const opportunityModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector
    .withList({
      request: (props) => ({
        endpoint: "/objects/deals",
        method: "GET",
        params: {
          limit: 100,
          after: props.cursor,
          properties: [
            "dealname",
            "amount",
            "closedate",
            "dealstage",
            "hubspot_owner_id",
          ].join(","),
          associations: "companies",
        },
      }),
      responseSchema: HubSpotDealListResponseSchema,
      pagination: ({ response }) => ({
        cursor: response.paging?.next?.after,
        hasMore: !!response.paging?.next?.after,
      }),
      transform: (response) =>
        response.results.map((result) => ({
          externalId: result.id,
          externalUpdatedAt: result.updatedAt,
          data: {
            name: result.properties.dealname,
            amount: result.properties.amount,
            closeDate: result.properties.closedate,
            stage: result.properties.dealstage,
            accountId:
              result.associations?.companies?.results?.find(
                (assoc) => assoc.type === "deal_to_company"
              )?.id || null,
            ownerId:
              result.properties.hubspot_owner_id === ""
                ? null
                : result.properties.hubspot_owner_id,
          },
        })),
    })
    .withCreate({
      request: (obj) => ({
        endpoint: "/objects/deals",
        method: "POST",
        json: {
          properties: {
            dealname: obj.name,
            amount: obj.amount,
            closedate: obj.closeDate,
            dealstage: obj.stage,
            hubspot_owner_id: obj.ownerId,
          },
          associations: obj.accountId
            ? [
                {
                  to: {
                    id: obj.accountId,
                  },
                  types: [
                    {
                      associationCategory: "HUBSPOT_DEFINED",
                      associationTypeId: 341, // deal_to_company
                    },
                  ],
                },
              ]
            : [],
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
        endpoint: `/objects/deals/${externalId}`,
        method: "PATCH",
        json: {
          properties: {
            dealname: obj.name,
            amount: obj.amount,
            closedate: obj.closeDate,
            dealstage: obj.stage,
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
        endpoint: `/objects/deals/${externalId}`,
        method: "DELETE",
      }),
    });
