import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";
import { buildQueryRequest, getPagination, ListRequestProps } from "./_util";

// Meetings can map to Event objects
const SalesforceEventSchema = z.object({
  Id: z.string(),
  Subject: z.string().nullable(),
  Description: z.string().nullable(),
  StartDateTime: z.string().nullable(),
  EndDateTime: z.string().nullable(),
  LastModifiedDate: z.string(),
});

const SalesforceEventListResponseSchema = z.object({
  done: z.boolean(),
  totalSize: z.number(),
  nextRecordsUrl: z.string().optional(),
  records: z.array(SalesforceEventSchema),
});

export const meetingModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector.withList({
    request: (props: ListRequestProps | undefined) =>
      buildQueryRequest(
        props,
        [
          "SELECT Id, Subject, Description, StartDateTime, EndDateTime, LastModifiedDate",
          "FROM Event",
          "ORDER BY LastModifiedDate DESC",
          "LIMIT 200",
        ].join(" ")
      ),
    responseSchema: SalesforceEventListResponseSchema,
    pagination: ({ response }) => getPagination(response),
    transform: (response) =>
      response.records.map((e) => ({
        externalId: e.Id,
        externalUpdatedAt: e.LastModifiedDate,
        data: {
          subject: e.Subject,
          content: e.Description,
          startTime: e.StartDateTime,
          endTime: e.EndDateTime,
        },
      })),
  });
