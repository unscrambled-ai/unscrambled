import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import { buildQueryRequest, getPagination, ListRequestProps } from "./_util";

// Salesforce logs calls as Task records with Type='Call'
type SalesforceCall = {
  Id: string;
  Subject: string | null;
  Description: string | null;
  ActivityDate: string | null;
  CallDurationInSeconds: number | null;
  LastModifiedDate: string;
};

type SalesforceCallListResponse = {
  done: boolean;
  totalSize: number;
  nextRecordsUrl?: string;
  records: SalesforceCall[];
};

export const callModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector.withList({
    request: (props: ListRequestProps | undefined) =>
      buildQueryRequest(
        props,
        [
          "SELECT Id, Subject, Description, ActivityDate, CallDurationInSeconds, LastModifiedDate",
          "FROM Task",
          "WHERE Type = 'Call'",
          "ORDER BY LastModifiedDate DESC",
          "LIMIT 200",
        ].join(" ")
      ),
    pagination: ({ response }: { response: SalesforceCallListResponse }) =>
      getPagination(response),
    transform: (response: SalesforceCallListResponse) =>
      response.records.map((c: SalesforceCall) => ({
        externalId: c.Id,
        externalUpdatedAt: c.LastModifiedDate,
        data: {
          subject: c.Subject,
          content: c.Description,
          timestamp: c.ActivityDate,
          duration:
            c.CallDurationInSeconds == null
              ? null
              : String(c.CallDurationInSeconds),
        },
      })),
  });
