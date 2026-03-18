import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";
import { buildQueryRequest, getPagination, ListRequestProps } from "./_util";

const SalesforceTaskSchema = z.object({
  Id: z.string(),
  Subject: z.string().nullable(),
  Description: z.string().nullable(),
  ActivityDate: z.string().nullable(),
  Status: z.string().nullable(),
  CompletedDateTime: z.string().nullable(),
  LastModifiedDate: z.string(),
});

const SalesforceTaskListResponseSchema = z.object({
  done: z.boolean(),
  totalSize: z.number(),
  nextRecordsUrl: z.string().optional(),
  records: z.array(SalesforceTaskSchema),
});

export const taskModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector.withList({
    request: (props: ListRequestProps | undefined) =>
      buildQueryRequest(
        props,
        [
          "SELECT Id, Subject, Description, ActivityDate, Status, CompletedDateTime, LastModifiedDate",
          "FROM Task",
          "ORDER BY LastModifiedDate DESC",
          "LIMIT 200",
        ].join(" ")
      ),
    responseSchema: SalesforceTaskListResponseSchema,
    pagination: ({ response }) => getPagination(response),
    transform: (response) =>
      response.records.map((t) => ({
        externalId: t.Id,
        externalUpdatedAt: t.LastModifiedDate,
        data: {
          subject: t.Subject,
          content: t.Description,
          dueDate: t.ActivityDate,
          status: t.Status,
          completedDate: t.CompletedDateTime,
        },
      })),
  });
