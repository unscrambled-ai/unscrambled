import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";

const HubSpotMeetingSchema = z.object({
  id: z.string(),
  properties: z.object({
    hs_meeting_title: z.string().nullable(),
    hs_meeting_body: z.string().nullable(),
    hs_meeting_start_time: z.string().nullable(),
    hs_meeting_end_time: z.string().nullable(),
    hs_lastmodifieddate: z.string(),
    hs_object_id: z.string(),
    createdate: z.string(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean(),
});

const HubSpotMeetingListResponseSchema = z.object({
  results: z.array(HubSpotMeetingSchema),
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

export const meetingModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector
    .withList({
      request: (props) => ({
        endpoint: "/objects/meetings",
        method: "GET",
        params: {
          limit: 100,
          after: props.cursor,
          properties: [
            "hs_meeting_title",
            "hs_meeting_body",
            "hs_meeting_start_time",
            "hs_meeting_end_time",
          ].join(","),
        },
      }),
      responseSchema: HubSpotMeetingListResponseSchema,
      pagination: ({ response }) => ({
        cursor: response.paging?.next?.after,
        hasMore: !!response.paging?.next?.after,
      }),
      transform: (response) =>
        response.results.map((result) => ({
          externalId: result.id,
          externalUpdatedAt: result.updatedAt,
          data: {
            subject: result.properties.hs_meeting_title,
            content: result.properties.hs_meeting_body,
            startTime: result.properties.hs_meeting_start_time,
            endTime: result.properties.hs_meeting_end_time,
          },
        })),
    })
    .withCreate({
      request: (obj) => ({
        endpoint: "/objects/meetings",
        method: "POST",
        json: {
          properties: {
            hs_meeting_title: obj.subject,
            hs_meeting_body: obj.content,
            hs_meeting_start_time: obj.startTime,
            hs_meeting_end_time: obj.endTime,
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
        endpoint: `/objects/meetings/${externalId}`,
        method: "PATCH",
        json: {
          properties: {
            hs_meeting_title: obj.subject,
            hs_meeting_body: obj.content,
            hs_meeting_start_time: obj.startTime,
            hs_meeting_end_time: obj.endTime,
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
        endpoint: `/objects/meetings/${externalId}`,
        method: "DELETE",
      }),
    });
