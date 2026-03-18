import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";

const HubSpotNoteSchema = z.object({
  id: z.string(),
  properties: z.object({
    hs_note_body: z.string().nullable(),
    hs_timestamp: z.string().nullable(),
    hs_lastmodifieddate: z.string(),
    hs_object_id: z.string(),
    createdate: z.string(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean(),
});

const HubSpotNoteListResponseSchema = z.object({
  results: z.array(HubSpotNoteSchema),
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

export const noteModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector
    .withList({
      request: (props) => ({
        endpoint: "/objects/notes",
        method: "GET",
        params: {
          limit: 100,
          after: props.cursor,
          properties: ["hs_note_body", "hs_timestamp"].join(","),
        },
      }),
      responseSchema: HubSpotNoteListResponseSchema,
      pagination: ({ response }) => ({
        hasMore: !!response.paging?.next?.after,
        cursor: response.paging?.next?.after,
      }),
      transform: (response) =>
        response.results.map((result) => ({
          externalId: result.id,
          externalUpdatedAt: result.updatedAt,
          data: {
            title: null, // HubSpot notes don't have a title field
            content: result.properties.hs_note_body,
            timestamp: result.properties.hs_timestamp,
          },
        })),
    })
    .withCreate({
      request: (obj) => ({
        endpoint: "/objects/notes",
        method: "POST",
        json: {
          properties: {
            hs_note_body: obj.content,
            hs_timestamp: obj.timestamp,
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
        endpoint: `/objects/notes/${externalId}`,
        method: "PATCH",
        json: {
          properties: {
            hs_note_body: obj.content,
            hs_timestamp: obj.timestamp,
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
        endpoint: `/objects/notes/${externalId}`,
        method: "DELETE",
      }),
    });
