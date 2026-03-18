/**
 * Sync Connector Examples
 *
 * Note: Each example demonstrates type inference by using the sync connector
 * in a way that shows the types are properly inferred.
 */

import { z } from "zod";
import { defineCollection, createSyncConnector, RestConnector } from "../src";

/**
 * Define a basic sync connector that works with a rest api and a collection
 */

// Define JSON Schema for our model (collections require JSON Schema)
const UserJsonSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    email: { type: "string", format: "email" },
  },
  required: ["name", "email"],
  additionalProperties: false,
} as const;

// Zod schema used only for HTTP response validation (optional)
const ZUser = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Create a collection using the JSON Schema
const userCollection = defineCollection("users")
  .addModel("user", { schema: UserJsonSchema })
  .deploy();

// Initialize REST connector
const apiConnector = new RestConnector({
  baseUrl: "https://api.example.com",
  headers: {
    Authorization: "Bearer {{ accessToken }}",
  },
});

// Create a basic sync connector
const basicSyncConnector = createSyncConnector(
  apiConnector,
  userCollection
).build();

// Access the connectors
const restConnector = basicSyncConnector.getRestConnector();
void restConnector;
const collection = basicSyncConnector.getCollection();
void collection;

/**
 * Define a sync connector that works with a rest api and a collection and has a model connector with a list method
 */

// Define response schema for list endpoint
const UserListResponseSchema = z.object({
  users: z.array(ZUser),
  nextPage: z.string().optional(),
  totalCount: z.number(),
});

// Create sync connector with list method
const syncConnectorWithList = createSyncConnector(apiConnector, userCollection)
  .withModelConnector("user", (modelConnector) =>
    modelConnector.withList({
      request: (params) => ({
        endpoint: "/users",
        method: "GET",
        params: {
          page: params.page || 1,
          limit: params.limit || 20,
        },
      }),
      responseSchema: UserListResponseSchema,
      transform: (response) =>
        response.users.map((u) => ({
          externalId: u.id,
          externalUpdatedAt: u.updatedAt,
          data: {
            name: u.name,
            email: u.email,
          },
        })),
    })
  )
  .build();

// Demonstrate type inference with list method
async function demonstrateListTypeInference() {
  const userConnector = syncConnectorWithList.getModelConnector("user");

  if (userConnector?.list) {
    const result = await userConnector.list({
      page: 1,
      limit: 10,
      syncType: "FULL",
    });
    // result.items is Array<{ externalId, externalUpdatedAt, data: User }>
    result.items.forEach(({ data }) => {
      console.log(data.name);
      console.log(data.email);
    });
  }
}

/**
 * Define a sync connector that works with a rest api and a collection and has a model connector with a list method and a create method
 */

const syncConnectorWithListAndCreate = createSyncConnector(
  apiConnector,
  userCollection
)
  .withModelConnector("user", (modelConnector) =>
    modelConnector
      .withList({
        request: (params) => ({
          endpoint: "/users",
          params: {
            page: params.page || 1,
            limit: params.limit || 20,
          },
        }),
        responseSchema: UserListResponseSchema,
        transform: (response) =>
          response.users.map((u) => ({
            externalId: u.id,
            externalUpdatedAt: u.updatedAt,
            data: u,
          })),
      })
      .withCreate({
        request: (obj) => ({
          endpoint: "/users",
          method: "POST",
          data: obj,
        }),
        responseSchema: z.object({ data: ZUser }),
        extract: (response) => ({
          externalId: response.data.id,
          externalUpdatedAt: response.data.updatedAt,
        }),
      })
  )
  .build();

// Demonstrate type inference with list and create methods
async function demonstrateListAndCreateTypeInference() {
  const userConnector =
    syncConnectorWithListAndCreate.getModelConnector("user");

  if (userConnector?.create) {
    // TypeScript enforces the correct user structure
    const newUser = await userConnector.create({
      name: "John Doe",
      email: "john@example.com",
    } as any);

    // Type-safe access to created user
    console.log(`Created user: ${newUser.name}`);
  }

  if (userConnector?.list) {
    const users = await userConnector.list({ page: 1, syncType: "FULL" });
    users.items.forEach(({ data }) => {
      console.log(`${data.name} - ${data.email}`);
    });
  }
}

/**
 * Define a sync connector that works with a rest api and a collection and has a model connector with a list method and a create, update, and delete method
 */

const fullCrudSyncConnector = createSyncConnector(apiConnector, userCollection)
  .withModelConnector("user", (modelConnector) =>
    modelConnector
      .withList({
        request: (params) => ({
          endpoint: "/users",
          params: {
            page: params.page || 1,
            limit: params.limit || 20,
          },
        }),
        responseSchema: UserListResponseSchema,
        pagination: (args) => ({
          cursor: args.response.nextPage ?? null,
          page: null,
          offset: null,
          hasMore: !!args.response.nextPage,
        }),
        transform: (response) =>
          response.users.map((u) => ({
            externalId: u.id,
            externalUpdatedAt: u.updatedAt,
            data: u,
          })),
      })
      .withCreate({
        request: (user) => ({
          endpoint: "/users",
          method: "POST",
          json: user,
        }),
        responseSchema: z.object({ data: ZUser }),
        extract: (response) => ({
          externalId: response.data.id,
          externalUpdatedAt: response.data.updatedAt,
        }),
      })
      .withUpdate({
        request: (externalId, obj) => ({
          endpoint: `/users/${externalId}`,
          method: "PUT",
          json: obj,
        }),
        responseSchema: z.object({ data: ZUser }),
        extract: (response) => ({
          externalUpdatedAt: response.data.updatedAt,
        }),
      })
      .withDelete({
        request: (externalId) => ({
          endpoint: `/users/${externalId}`,
          method: "DELETE",
        }),
      })
  )
  .build();

// Demonstrate type inference with all CRUD methods
async function demonstrateFullCrudTypeInference() {
  const userConnector = fullCrudSyncConnector.getModelConnector("user");

  if (!userConnector) {
    throw new Error("User connector not found");
  }

  // CREATE - TypeScript enforces correct user structure
  if (userConnector.create) {
    const newUser = await userConnector.create({
      name: "Jane Smith",
      email: "jane@example.com",
    } as any);
    console.log(`Created user: ${newUser.name}`);

    // UPDATE - TypeScript knows this is Partial<User>
    if (userConnector.update) {
      const updatedUser = await userConnector.update((newUser as any).id, {
        name: "Jane Doe",
      } as any);
      console.log(`Updated user: ${updatedUser.name}`);
    }

    // LIST - TypeScript infers User[] for items
    if (userConnector.list) {
      const userList = await userConnector.list({ page: 1, syncType: "FULL" });

      userList.items.forEach(({ data }) => {
        // All user properties are type-safe
        console.log(`${data.name} (${data.email})`);
      });
    }

    // DELETE - TypeScript ensures id is a string
    if (userConnector.delete) {
      await userConnector.delete((newUser as any).id);
      console.log("Deleted user");
    }
  }
}

// Cursor-based pagination using a function and nested props.pagination
const cursorStyleSyncConnector = createSyncConnector(
  apiConnector,
  userCollection
)
  .withModelConnector("user", (modelConnector) =>
    modelConnector.withList({
      request: (props) => ({
        endpoint: "/users",
        method: "GET",
        params: {
          cursor: props.cursor,
        },
      }),
      responseSchema: UserListResponseSchema,
      transform: (response) =>
        response.users.map((u) => ({
          externalId: u.id,
          externalUpdatedAt: u.updatedAt,
          data: {
            name: u.name,
            email: u.email,
          },
        })),
      pagination: (args) => ({
        cursor: args.response.nextPage ?? null,
        page: null,
        offset: null,
        hasMore: !!args.response.nextPage,
      }),
    })
  )
  .build();

async function demonstrateFunctionPagination() {
  const userConnector = cursorStyleSyncConnector.getModelConnector("user");
  if (userConnector?.list) {
    const first = await userConnector.list({ syncType: "FULL" });
    first.items.forEach(({ data }) => {
      console.log(`${data.name} - ${data.email}`);
    });
  }
}

/**
 * Define a duplicate sync connector with an additional model connector
 */

const duplicatedFullCrudSyncConnector = createSyncConnector
  .from(fullCrudSyncConnector)
  .withModelConnector("user", (b) =>
    b.withCreate({
      request: (obj) => ({ endpoint: "/users", method: "POST", json: obj }),
      responseSchema: ZUser,
      extract: (res) => ({
        externalId: res.id,
        externalUpdatedAt: res.updatedAt,
      }),
    })
  )
  .build();

void duplicatedFullCrudSyncConnector;

// Export examples for testing
export {
  demonstrateListTypeInference,
  demonstrateListAndCreateTypeInference,
  demonstrateFullCrudTypeInference,
  demonstrateFunctionPagination,
};

// --- Additional compile-time safety examples for SyncConnector ---

// Ensure list transform returns items with a stable id
const ListResp = z.object({
  items: z.array(
    z.object({ taskId: z.string(), updatedAt: z.string().nullable() })
  ),
});

const TaskJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    updatedAt: { oneOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["id", "title"],
} as const;

const taskCollection = defineCollection("task_mgmt")
  .addModel("task", { schema: TaskJsonSchema })
  .deploy();

const rest = new RestConnector({ baseUrl: "https://api.example.com" });

const taskSync = createSyncConnector(rest, taskCollection)
  .withModelConnector("task", (m) =>
    m
      .withList({
        request: () => ({ endpoint: "/tasks" }),
        responseSchema: ListResp,
        // @ts-expect-error mapping must return items with `id`, `externalUpdatedAt`, and `data`
        transform: (r) => r.items, // missing mapping from taskId -> externalId and wrapping as data
      })
      .withCreate({
        request: (obj) => ({ endpoint: "/tasks", method: "POST", json: obj }),
        responseSchema: z.object({
          id: z.string(),
          updatedAt: z.string().nullable(),
        }),
        // @ts-expect-error extract must return externalId and externalUpdatedAt
        extract: (_res) => ({ externalId: _res.id }),
      })
      .withUpdate({
        request: (id, obj) => ({
          endpoint: `/tasks/${id}`,
          method: "PUT",
          json: obj,
        }),
        responseSchema: z.object({
          id: z.string(),
          updatedAt: z.string().nullable(),
        }),
        // Correct extract example
        extract: (res) => ({
          externalId: res.id,
          externalUpdatedAt: res.updatedAt,
        }),
      })
  )
  .build();
