import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";
import { buildQueryRequest, getPagination, ListRequestProps } from "./_util";

const SalesforceOpportunityLineItemSchema = z.object({
  Id: z.string(),
  Name: z.string().nullable(),
  Quantity: z.number().nullable(),
  TotalPrice: z.number().nullable(),
  OpportunityId: z.string().nullable(),
  PricebookEntryId: z.string().nullable(),
  LastModifiedDate: z.string(),
});

const SalesforceOpportunityLineItemListResponseSchema = z.object({
  done: z.boolean(),
  totalSize: z.number(),
  nextRecordsUrl: z.string().optional(),
  records: z.array(SalesforceOpportunityLineItemSchema),
});

export const opportunityLineItemModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector.withList({
    request: (props: ListRequestProps | undefined) =>
      buildQueryRequest(
        props,
        [
          "SELECT Id, Name, Quantity, TotalPrice, OpportunityId, PricebookEntryId, LastModifiedDate",
          "FROM OpportunityLineItem",
          "ORDER BY LastModifiedDate DESC",
          "LIMIT 200",
        ].join(" ")
      ),
    responseSchema: SalesforceOpportunityLineItemListResponseSchema,
    pagination: ({ response }) => getPagination(response),
    transform: (response) =>
      response.records.map((li) => ({
        externalId: li.Id,
        externalUpdatedAt: li.LastModifiedDate,
        data: {
          name: li.Name,
          quantity: li.Quantity == null ? null : String(li.Quantity),
          price: li.TotalPrice == null ? null : String(li.TotalPrice),
          opportunityId: li.OpportunityId,
          productId: li.PricebookEntryId, // Mapping: requires join to Product2 via PricebookEntry
        },
      })),
  });
