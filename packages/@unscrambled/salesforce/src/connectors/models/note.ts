import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";
import { buildQueryRequest, getPagination, ListRequestProps } from "./_util";

// Notes map to ContentNote or Note; using Note here for simplicity
const SalesforceNoteSchema = z.object({
  Id: z.string(),
  Title: z.string().nullable(),
  Body: z.string().nullable(),
  CreatedDate: z.string().nullable(),
  LastModifiedDate: z.string(),
});

const SalesforceNoteListResponseSchema = z.object({
  done: z.boolean(),
  totalSize: z.number(),
  nextRecordsUrl: z.string().optional(),
  records: z.array(SalesforceNoteSchema),
});

export const noteModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector.withList({
    request: (props: ListRequestProps | undefined) =>
      buildQueryRequest(
        props,
        [
          "SELECT Id, Title, Body, CreatedDate, LastModifiedDate",
          "FROM Note",
          "ORDER BY LastModifiedDate DESC",
          "LIMIT 200",
        ].join(" ")
      ),
    responseSchema: SalesforceNoteListResponseSchema,
    pagination: ({ response }) => getPagination(response),
    transform: (response) =>
      response.records.map((n) => ({
        externalId: n.Id,
        externalUpdatedAt: n.LastModifiedDate,
        data: {
          title: n.Title,
          content: n.Body,
          timestamp: n.CreatedDate,
        },
      })),
  });
