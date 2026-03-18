import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";

const HubSpotCallSchema = z.object({
  id: z.string(),
  properties: z.object({
    hs_call_title: z.string().nullable(),
    hs_call_body: z.string().nullable(),
    hs_timestamp: z.string().nullable(),
    hs_call_duration: z.string().nullable(),
    hs_lastmodifieddate: z.string(),
    hs_object_id: z.string(),
    createdate: z.string(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean(),
});

const HubSpotCallListResponseSchema = z.object({
  results: z.array(HubSpotCallSchema),
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

export const callModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector
    .withList({
      request: (props) => ({
        endpoint: "/objects/calls",
        method: "GET",
        params: {
          limit: 100,
          after: props.cursor,
          properties: [
            "hs_call_title",
            "hs_call_body",
            "hs_timestamp",
            "hs_call_duration",
          ].join(","),
        },
      }),
      responseSchema: HubSpotCallListResponseSchema,
      pagination: ({ response }) => ({
        hasMore: !!response.paging?.next?.after,
        cursor: response.paging?.next?.after,
      }),
      transform: (response) =>
        response.results.map((result) => ({
          externalId: result.id,
          externalUpdatedAt: result.updatedAt,
          data: {
            subject: result.properties.hs_call_title,
            content: result.properties.hs_call_body,
            timestamp: result.properties.hs_timestamp,
            duration: result.properties.hs_call_duration,
          },
        })),
    })
    .withCreate({
      request: (obj) => ({
        endpoint: "/objects/calls",
        method: "POST",
        json: {
          properties: {
            hs_call_title: obj.subject,
            hs_call_body: obj.content,
            hs_timestamp: obj.timestamp,
            hs_call_duration: obj.duration,
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
        endpoint: `/objects/calls/${externalId}`,
        method: "PATCH",
        json: {
          properties: {
            hs_call_title: obj.subject,
            hs_call_body: obj.content,
            hs_timestamp: obj.timestamp,
            hs_call_duration: obj.duration,
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
        endpoint: `/objects/calls/${externalId}`,
        method: "DELETE",
      }),
    });
