import { SyncModelConnectorBuilder } from "@unscrambled/sdk";
import z from "zod";

const HubSpotOwnerSchema = z.object({
  id: z.string(),
  email: z.string(),
  type: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  userId: z.number(),
  userIdIncludingInactive: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean(),
});

const HubSpotOwnerListResponseSchema = z.object({
  results: z.array(HubSpotOwnerSchema),
});

export const userModelConnector = (
  modelConnector: SyncModelConnectorBuilder<any>
) =>
  modelConnector.withList({
    request: (props) => ({
      endpoint: "/owners",
      method: "GET",
    }),
    responseSchema: HubSpotOwnerListResponseSchema,
    transform: (response) =>
      response.results.map((result) => ({
        externalId: result.id,
        externalUpdatedAt: result.updatedAt,
        data: {
          firstName: result.firstName,
          lastName: result.lastName,
          email: result.email,
          username: result.userId.toString(),
        },
      })),
  });
