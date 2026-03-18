import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";
import { buildQueryRequest, getPagination, ListRequestProps } from "./_util";

const SalesforceOpportunitySchema = z.object({
  Id: z.string(),
  Name: z.string().nullable(),
  Amount: z.number().nullable(),
  CloseDate: z.string().nullable(),
  StageName: z.string().nullable(),
  AccountId: z.string().nullable(),
  OwnerId: z.string().nullable(),
  LastModifiedDate: z.string(),
});

const SalesforceOpportunityListResponseSchema = z.object({
  done: z.boolean(),
  totalSize: z.number(),
  nextRecordsUrl: z.string().optional(),
  records: z.array(SalesforceOpportunitySchema),
});

export const opportunityModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector.withList({
    request: (props: ListRequestProps | undefined) =>
      buildQueryRequest(
        props,
        [
          "SELECT Id, Name, Amount, CloseDate, StageName, AccountId, OwnerId, LastModifiedDate",
          "FROM Opportunity",
          "ORDER BY LastModifiedDate DESC",
          "LIMIT 200",
        ].join(" ")
      ),
    responseSchema: SalesforceOpportunityListResponseSchema,
    pagination: ({ response }) => getPagination(response),
    transform: (response) =>
      response.records.map((o) => ({
        externalId: o.Id,
        externalUpdatedAt: o.LastModifiedDate,
        data: {
          name: o.Name,
          amount: o.Amount == null ? null : String(o.Amount),
          closeDate: o.CloseDate,
          stage: o.StageName,
          accountId: o.AccountId,
          ownerId: o.OwnerId,
        },
      })),
  });
