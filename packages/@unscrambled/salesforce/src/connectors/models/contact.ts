import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import { buildQueryRequest, getPagination, ListRequestProps } from "./_util";

type SalesforceContact = {
  Id: string;
  FirstName: string | null;
  LastName: string | null;
  Title: string | null;
  Email: string | null;
  Phone: string | null;
  MobilePhone: string | null;
  MailingStreet: string | null;
  MailingCity: string | null;
  MailingState: string | null;
  MailingPostalCode: string | null;
  MailingCountry: string | null;
  OtherStreet: string | null;
  OtherCity: string | null;
  OtherState: string | null;
  OtherPostalCode: string | null;
  OtherCountry: string | null;
  AccountId: string | null;
  OwnerId: string | null;
  LastModifiedDate: string;
};

type SalesforceContactListResponse = {
  done: boolean;
  totalSize: number;
  nextRecordsUrl?: string;
  records: SalesforceContact[];
};

export const contactModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector.withList({
    request: (props: ListRequestProps | undefined) =>
      buildQueryRequest(
        props,
        [
          "SELECT Id, FirstName, LastName, Title, Email, Phone, MobilePhone,",
          "MailingStreet, MailingCity, MailingState, MailingPostalCode, MailingCountry,",
          "OtherStreet, OtherCity, OtherState, OtherPostalCode, OtherCountry,",
          "AccountId, OwnerId, LastModifiedDate",
          "FROM Contact",
          "ORDER BY LastModifiedDate DESC",
          "LIMIT 200",
        ].join(" ")
      ),
    pagination: ({ response }: { response: SalesforceContactListResponse }) =>
      getPagination(response),
    transform: (response: SalesforceContactListResponse) =>
      response.records.map((c: SalesforceContact) => ({
        externalId: c.Id,
        externalUpdatedAt: c.LastModifiedDate,
        data: {
          firstName: c.FirstName,
          lastName: c.LastName,
          title: c.Title,
          email: c.Email,
          phone: c.Phone,
          mobile: c.MobilePhone,
          address: {
            street: c.MailingStreet ?? c.OtherStreet,
            city: c.MailingCity ?? c.OtherCity,
            state: c.MailingState ?? c.OtherState,
            postalCode: c.MailingPostalCode ?? c.OtherPostalCode,
            country: c.MailingCountry ?? c.OtherCountry,
          },
          mailingAddress: {
            street: c.MailingStreet,
            city: c.MailingCity,
            state: c.MailingState,
            postalCode: c.MailingPostalCode,
            country: c.MailingCountry,
          },
          otherAddress: {
            street: c.OtherStreet,
            city: c.OtherCity,
            state: c.OtherState,
            postalCode: c.OtherPostalCode,
            country: c.OtherCountry,
          },
          accountId: c.AccountId,
          ownerId: c.OwnerId,
        },
      })),
  });
