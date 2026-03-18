import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";
import { buildQueryRequest, getPagination, ListRequestProps } from "./_util";

const SalesforceAccountSchema = z.object({
  Id: z.string(),
  Name: z.string().nullable(),
  Website: z.string().nullable(),
  Phone: z.string().nullable(),
  BillingStreet: z.string().nullable(),
  BillingCity: z.string().nullable(),
  BillingState: z.string().nullable(),
  BillingPostalCode: z.string().nullable(),
  BillingCountry: z.string().nullable(),
  ShippingStreet: z.string().nullable(),
  ShippingCity: z.string().nullable(),
  ShippingState: z.string().nullable(),
  ShippingPostalCode: z.string().nullable(),
  ShippingCountry: z.string().nullable(),
  Industry: z.string().nullable(),
  NumberOfEmployees: z.number().nullable(),
  OwnerId: z.string().nullable(),
  LastModifiedDate: z.string(),
});

const SalesforceAccountListResponseSchema = z.object({
  done: z.boolean(),
  totalSize: z.number(),
  nextRecordsUrl: z.string().optional(),
  records: z.array(SalesforceAccountSchema),
});

export const accountModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector.withList({
    request: (props: ListRequestProps | undefined) =>
      buildQueryRequest(
        props,
        [
          "SELECT Id, Name, Website, Phone,",
          "BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry,",
          "ShippingStreet, ShippingCity, ShippingState, ShippingPostalCode, ShippingCountry,",
          "Industry, NumberOfEmployees, OwnerId, LastModifiedDate",
          "FROM Account",
          "ORDER BY LastModifiedDate DESC",
          "LIMIT 200",
        ].join(" ")
      ),
    responseSchema: SalesforceAccountListResponseSchema,
    pagination: ({ response }) => getPagination(response),
    transform: (response) =>
      response.records.map((a) => ({
        externalId: a.Id,
        externalUpdatedAt: a.LastModifiedDate,
        data: {
          name: a.Name,
          website: a.Website,
          phone: a.Phone,
          address: {
            street: a.ShippingStreet ?? a.BillingStreet,
            city: a.ShippingCity ?? a.BillingCity,
            state: a.ShippingState ?? a.BillingState,
            postalCode: a.ShippingPostalCode ?? a.BillingPostalCode,
            country: a.ShippingCountry ?? a.BillingCountry,
          },
          billingAddress: {
            street: a.BillingStreet,
            city: a.BillingCity,
            state: a.BillingState,
            postalCode: a.BillingPostalCode,
            country: a.BillingCountry,
          },
          shippingAddress: {
            street: a.ShippingStreet,
            city: a.ShippingCity,
            state: a.ShippingState,
            postalCode: a.ShippingPostalCode,
            country: a.ShippingCountry,
          },
          industry: a.Industry,
          numberOfEmployees:
            a.NumberOfEmployees == null ? null : String(a.NumberOfEmployees),
          ownerId: a.OwnerId,
        },
      })),
  });
