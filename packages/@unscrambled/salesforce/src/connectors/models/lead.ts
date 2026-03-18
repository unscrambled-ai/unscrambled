import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";
import { buildQueryRequest, getPagination, ListRequestProps } from "./_util";

const SalesforceLeadSchema = z.object({
  Id: z.string(),
  FirstName: z.string().nullable(),
  LastName: z.string().nullable(),
  Company: z.string().nullable(),
  Title: z.string().nullable(),
  Email: z.string().nullable(),
  Phone: z.string().nullable(),
  MobilePhone: z.string().nullable(),
  Street: z.string().nullable(),
  City: z.string().nullable(),
  State: z.string().nullable(),
  PostalCode: z.string().nullable(),
  Country: z.string().nullable(),
  OwnerId: z.string().nullable(),
  LastModifiedDate: z.string(),
});

const SalesforceLeadListResponseSchema = z.object({
  done: z.boolean(),
  totalSize: z.number(),
  nextRecordsUrl: z.string().optional(),
  records: z.array(SalesforceLeadSchema),
});

export const leadModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector.withList({
    request: (props: ListRequestProps | undefined) =>
      buildQueryRequest(
        props,
        [
          "SELECT Id, FirstName, LastName, Company, Title, Email, Phone, MobilePhone,",
          "Street, City, State, PostalCode, Country, OwnerId, LastModifiedDate",
          "FROM Lead",
          "ORDER BY LastModifiedDate DESC",
          "LIMIT 200",
        ].join(" ")
      ),
    responseSchema: SalesforceLeadListResponseSchema,
    pagination: ({ response }) => getPagination(response),
    transform: (response) =>
      response.records.map((l) => ({
        externalId: l.Id,
        externalUpdatedAt: l.LastModifiedDate,
        data: {
          firstName: l.FirstName,
          lastName: l.LastName,
          email: l.Email,
          phone: l.Phone,
          mobile: l.MobilePhone,
          address: {
            street: l.Street,
            city: l.City,
            state: l.State,
            postalCode: l.PostalCode,
            country: l.Country,
          },
          ownerId: l.OwnerId,
        },
      })),
  });
