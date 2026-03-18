import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";
import { buildQueryRequest, getPagination, ListRequestProps } from "./_util";

const SalesforceUserSchema = z.object({
  Id: z.string(),
  Username: z.string().nullable(),
  Email: z.string().nullable(),
  FirstName: z.string().nullable(),
  LastName: z.string().nullable(),
  LastModifiedDate: z.string(),
});

const SalesforceUserListResponseSchema = z.object({
  done: z.boolean(),
  totalSize: z.number(),
  nextRecordsUrl: z.string().optional(),
  records: z.array(SalesforceUserSchema),
});

export const userModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector.withList({
    request: (props: ListRequestProps | undefined) =>
      buildQueryRequest(
        props,
        [
          "SELECT Id, Username, Email, FirstName, LastName, LastModifiedDate",
          "FROM User",
          "ORDER BY LastModifiedDate DESC",
          "LIMIT 200",
        ].join(" ")
      ),
    responseSchema: SalesforceUserListResponseSchema,
    pagination: ({ response }) => getPagination(response),
    transform: (response) =>
      response.records.map((u) => ({
        externalId: u.Id,
        externalUpdatedAt: u.LastModifiedDate,
        data: {
          username: u.Username,
          email: u.Email,
          firstName: u.FirstName,
          lastName: u.LastName,
        },
      })),
  });
