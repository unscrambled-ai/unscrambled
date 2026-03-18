import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";
import { buildQueryRequest, getPagination, ListRequestProps } from "./_util";

const SalesforceProductSchema = z.object({
  Id: z.string(),
  Name: z.string().nullable(),
  Description: z.string().nullable(),
  ProductCode: z.string().nullable(),
  // PricebookEntry holds price; for simplicity, we pull Product2 fields here
  LastModifiedDate: z.string(),
});

const SalesforceProductListResponseSchema = z.object({
  done: z.boolean(),
  totalSize: z.number(),
  nextRecordsUrl: z.string().optional(),
  records: z.array(SalesforceProductSchema),
});

export const productModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector.withList({
    request: (props: ListRequestProps | undefined) =>
      buildQueryRequest(
        props,
        [
          "SELECT Id, Name, Description, ProductCode, LastModifiedDate",
          "FROM Product2",
          "ORDER BY LastModifiedDate DESC",
          "LIMIT 200",
        ].join(" ")
      ),
    responseSchema: SalesforceProductListResponseSchema,
    pagination: ({ response }) => getPagination(response),
    transform: (response) =>
      response.records.map((p) => ({
        externalId: p.Id,
        externalUpdatedAt: p.LastModifiedDate,
        data: {
          name: p.Name,
          description: p.Description,
          price: null, // PricebookEntry association required for price; omitted in basic list
          code: p.ProductCode,
        },
      })),
  });
