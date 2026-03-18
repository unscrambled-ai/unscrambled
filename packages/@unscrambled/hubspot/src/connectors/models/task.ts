import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";

const HubSpotTaskSchema = z.object({
  id: z.string(),
  properties: z.object({
    hs_task_subject: z.string().nullable(),
    hs_task_body: z.string().nullable(),
    hs_timestamp: z.string().nullable(),
    hs_task_status: z.string().nullable(),
    hs_task_completion_date: z.string().nullable(),
    hs_lastmodifieddate: z.string(),
    hs_object_id: z.string(),
    createdate: z.string(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean(),
});

const HubSpotTaskListResponseSchema = z.object({
  results: z.array(HubSpotTaskSchema),
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

export const taskModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector
    .withList({
      request: (props) => ({
        endpoint: "/objects/tasks",
        method: "GET",
        params: {
          limit: 100,
          after: props.cursor,
          properties: [
            "hs_task_subject",
            "hs_task_body",
            "hs_timestamp",
            "hs_task_status",
            "hs_task_completion_date",
          ].join(","),
        },
      }),
      responseSchema: HubSpotTaskListResponseSchema,
      pagination: ({ response }) => ({
        cursor: response.paging?.next?.after,
        hasMore: !!response.paging?.next?.after,
      }),
      transform: (response) =>
        response.results.map((result) => ({
          externalId: result.id,
          externalUpdatedAt: result.updatedAt,
          data: {
            subject: result.properties.hs_task_subject,
            content: result.properties.hs_task_body,
            dueDate: result.properties.hs_timestamp,
            status: result.properties.hs_task_status,
            completedDate: result.properties.hs_task_completion_date,
          },
        })),
    })
    .withCreate({
      request: (obj) => ({
        endpoint: "/objects/tasks",
        method: "POST",
        json: {
          properties: {
            hs_task_subject: obj.subject,
            hs_task_body: obj.content,
            hs_timestamp: obj.dueDate,
            hs_task_status: obj.status,
            hs_task_completion_date: obj.completedDate,
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
        endpoint: `/objects/tasks/${externalId}`,
        method: "PATCH",
        json: {
          properties: {
            hs_task_subject: obj.subject,
            hs_task_body: obj.content,
            hs_timestamp: obj.dueDate,
            hs_task_status: obj.status,
            hs_task_completion_date: obj.completedDate,
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
        endpoint: `/objects/tasks/${externalId}`,
        method: "DELETE",
      }),
    });
