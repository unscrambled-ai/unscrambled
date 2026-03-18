import { z } from "zod";
import {
  defineCollection,
  createSyncConnector,
  defineAction,
  createRestConnector,
} from "../src";

// Define a basic model schema
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Create a collection
const usersCollection = defineCollection("users")
  .addModel("user", { schema: UserSchema })
  .deploy();

// Configure a REST connector via builder
const rest = createRestConnector()
  .withBaseUrl("https://api.example.com")
  .addHeader("Authorization", "Bearer {{ accessToken }}")
  .build();

const UserListResponseSchema = z.object({
  users: z.array(UserSchema),
  nextPage: z.string().optional(),
  totalCount: z.number(),
});

// Build a Sync Connector for the collection with a simple list config
const syncConnector = createSyncConnector(rest, usersCollection)
  .withModelConnector("user", (userModel) =>
    userModel.withList({
      request: (params) => ({
        endpoint: "/users",
        method: "GET",
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 50,
        },
      }),
      responseSchema: UserListResponseSchema,
      transform: (response) => response.users,
    })
  )
  .build();

// Example action that runs the sync
export const syncUsersAction = defineAction("sync-users")
  .withTitle("Sync Users")
  .withDescription("Pulls and pushes user data using the Sync Connector")
  .withRun(async () => {
    await syncConnector.sync();
  })
  .deploy();

// Optional: direct invocation would typically be handled by the platform runner
