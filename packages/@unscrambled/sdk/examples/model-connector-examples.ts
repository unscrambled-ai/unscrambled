import { z } from "zod";
import {
  defineCollection,
  defineModel,
  createRestConnector,
  createModelConnector,
  createListConfig,
  createCreateConfig,
  createUpdateConfig,
  createDeleteConfig,
} from "../src";

/**
 * Model Connector Examples
 *
 * These examples show how to create model connectors independently from sync connectors.
 * Model connectors allow you to connect a single model to a REST API endpoint.
 */

/**
 * Define a basic model connector that works with a rest api and a model from a collection
 */

// First create a collection
const basicCollection = defineCollection("tasks").withTitle("Tasks").deploy();

// Define a simple model that belongs to the collection
const basicModel = defineModel(basicCollection, "task")
  .withTitle("Task")
  .withSchema({
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      completed: { type: "boolean" },
    },
    required: ["id", "title", "completed"],
  })
  .deploy();

// Create a REST connector
const basicRestConnector = createRestConnector()
  .withBaseUrl("https://api.example.com")
  .build();

// Create a basic model connector
const basicModelConnector = createModelConnector(
  basicRestConnector,
  basicModel
).build();

// Usage example
async function useBasicModelConnector() {
  // The basic connector doesn't have any methods configured yet
  console.log(`Model connector for: ${basicModelConnector.modelName}`);
}

/**
 * Define a model connector that works with a rest api and a model from a collection and has a list method
 */

// Define a model with Zod schema for better type inference
const contactSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  createdAt: z.string().datetime(),
});

type Contact = z.infer<typeof contactSchema>;

// Create the collection first
const contactCollection = defineCollection("contacts")
  .withTitle("Contacts")
  .deploy();

// Create the model that belongs to the collection
const contactModel = defineModel(contactCollection, "contact")
  .withTitle("Contact")
  .withSchema(contactSchema as any)
  .deploy();

// Create REST connector
const contactRestConnector = createRestConnector()
  .withBaseUrl("https://api.contacts.com/v1")
  .addHeader("Authorization", "Bearer ${auth.accessToken}")
  .build();

// Define API response schema
const contactListResponseSchema = z.object({
  contacts: z.array(contactSchema),
  total: z.number(),
  page: z.number(),
  perPage: z.number(),
});

type ContactListResponse = z.infer<typeof contactListResponseSchema>;

// Create model connector with list method
const contactModelConnector = createModelConnector<Contact>(
  contactRestConnector,
  contactModel
)
  .list(
    createListConfig<Contact, ContactListResponse>({
      request: (params) => ({
        endpoint: "/contacts",
        params: {
          page: params.page || 1,
          per_page: params.limit || 20,
        },
      }),
      responseSchema: contactListResponseSchema,
      pagination: (({ response }: { response: ContactListResponse }) => ({
        cursor: undefined,
        page: null,
        offset: null,
        hasMore: false,
      })) as any,
      transform: (response) => {
        return response.contacts.map((c) => ({
          externalId: c.id,
          externalUpdatedAt: c.createdAt,
          data: c,
        }));
      },
    })
  )
  .build();

// Usage example showing type inference
async function useContactModelConnector() {
  if (contactModelConnector.list) {
    const { items, pagination } = await contactModelConnector.list({
      page: 1,
      limit: 20,
      syncType: "FULL",
    } as any);

    items.forEach(({ data }) => {
      console.log(`Contact: ${data.name} - ${data.email}`);
      if (data.phone) {
        console.log(`Phone: ${data.phone}`);
      }
    });
  }
}

/**
 * Define a model connector that works with a rest api and a model from a collection and has a list method and a create method
 */

// Define a user model with Zod schema
const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(["admin", "user", "guest"]),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

type User = z.infer<typeof userSchema>;

// Create user collection
const userCollection = defineCollection("users").withTitle("Users").deploy();

const userModel = defineModel(userCollection, "user")
  .withTitle("User")
  .withSchema(userSchema as any)
  .deploy();

// Create REST connector
const userRestConnector = createRestConnector()
  .withBaseUrl("https://api.users.com/v2")
  .withHeaders({
    "Content-Type": "application/json",
    "X-API-Key": "${secrets.apiKey}",
  })
  .build();

// Define API schemas
const apiUserSchema = z.object({
  user_id: z.string(),
  user_name: z.string(),
  email_address: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: z.enum(["admin", "user", "guest"]),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const userListResponseSchema = z.object({
  users: z.array(apiUserSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    hasMore: z.boolean(),
  }),
});

// Create model connector with list and create methods
const userModelConnector = createModelConnector<User>(
  userRestConnector,
  userModel
)
  .list(
    createListConfig<User, z.infer<typeof userListResponseSchema>>({
      request: (params) => ({
        endpoint: "/users",
        params: {
          page: params.page || 1,
          limit: params.limit || 50,
        },
      }),
      responseSchema: userListResponseSchema,
      transform: (response) => {
        return response.users.map((apiUser) => ({
          externalId: apiUser.user_id,
          externalUpdatedAt: apiUser.updated_at,
          data: {
            id: apiUser.user_id,
            username: apiUser.user_name,
            email: apiUser.email_address,
            firstName: apiUser.first_name,
            lastName: apiUser.last_name,
            role: apiUser.role,
            isActive: apiUser.is_active,
            createdAt: apiUser.created_at,
            updatedAt: apiUser.updated_at,
          },
        }));
      },
    })
  )
  .create(
    createCreateConfig<User>({
      request: (data) => ({
        endpoint: "/users",
        method: "POST",
        json: {
          // Transform to API format
          user_name: data.username,
          email_address: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          role: data.role,
          is_active: data.isActive,
        },
      }),
      transform: (response: z.infer<typeof apiUserSchema>) => ({
        // Transform back to model format
        id: response.user_id,
        username: response.user_name,
        email: response.email_address,
        firstName: response.first_name,
        lastName: response.last_name,
        role: response.role,
        isActive: response.is_active,
        createdAt: response.created_at,
        updatedAt: response.updated_at,
      }),
      extract: (item) => ({
        externalId: item.id,
        externalUpdatedAt: item.updatedAt,
      }),
    })
  )
  .build();

// Usage example
async function useUserModelConnector() {
  // List users
  if (userModelConnector.list) {
    const { items } = await userModelConnector.list({ page: 1 });

    items.forEach(({ data }) => {
      console.log(`User: ${data.username} (${data.role})`);
      console.log(`Name: ${data.firstName} ${data.lastName}`);
      console.log(`Active: ${data.isActive}`);
    });
  }

  // Create a user
  if (userModelConnector.create) {
    const newUser = await userModelConnector.create({
      id: "temp-id", // Will be replaced by server
      username: "johndoe",
      email: "john@example.com",
      firstName: "John",
      lastName: "Doe",
      role: "user",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log(`Created user: ${newUser.id} - ${newUser.username}`);
  }
}

/**
 * Define a model connector that works with a rest api and a model from a collection and has a list method and a create, update, and delete method
 */

// Define a product model with full CRUD
const productSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number().positive(),
  currency: z.string().default("USD"),
  inventory: z.number().int().nonnegative(),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

type Product = z.infer<typeof productSchema>;

// Create collection first
const productCollection = defineCollection("products")
  .withTitle("Products")
  .deploy();

const productModel = defineModel(productCollection, "product")
  .withTitle("Product")
  .withSchema(productSchema as any)
  .withMatchPattern("$.sku")
  .deploy();

// Create REST connector
const productRestConnector = createRestConnector()
  .withBaseUrl("https://api.store.com/v3")
  .withHeaders({
    "Content-Type": "application/json",
    "X-Store-ID": "${variables.storeId}",
    Authorization: "Bearer ${auth.accessToken}",
  })
  .build();

// API response schemas
const apiProductSchema = z.object({
  product_id: z.string(),
  sku: z.string(),
  product_name: z.string(),
  product_description: z.string(),
  price_cents: z.number(),
  currency_code: z.string(),
  stock_quantity: z.number(),
  category_name: z.string(),
  tags: z.array(z.string()),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const productListResponseSchema = z.object({
  products: z.array(apiProductSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    perPage: z.number(),
    totalPages: z.number(),
  }),
});

// Create full CRUD model connector
const productModelConnector = createModelConnector<Product>(
  productRestConnector,
  productModel
)
  .list(
    createListConfig<Product, z.infer<typeof productListResponseSchema>>({
      request: (params) => ({
        endpoint: "/products",
        params: {
          page: params.page || 1,
          per_page: params.limit || 100,
          offset: params.offset,
        },
      }),
      responseSchema: productListResponseSchema,
      pagination: ({ response: _r }) => ({
        cursor: undefined,
        page: null,
        offset: null,
        hasMore: false,
      }),
      transform: (response) => {
        return response.products.map((apiProduct) => ({
          externalId: apiProduct.product_id,
          externalUpdatedAt: apiProduct.updated_at,
          data: {
            id: apiProduct.product_id,
            sku: apiProduct.sku,
            name: apiProduct.product_name,
            description: apiProduct.product_description,
            price: apiProduct.price_cents / 100, // Convert from cents
            currency: apiProduct.currency_code,
            inventory: apiProduct.stock_quantity,
            category: apiProduct.category_name,
            tags: apiProduct.tags,
            isActive: apiProduct.is_active,
            createdAt: apiProduct.created_at,
            updatedAt: apiProduct.updated_at,
          },
        }));
      },
    })
  )
  .create(
    createCreateConfig<Product>({
      request: (data) => ({
        endpoint: "/products",
        method: "POST",
        json: {
          sku: data.sku,
          product_name: data.name,
          product_description: data.description,
          price_cents: Math.round(data.price * 100),
          currency_code: data.currency,
          stock_quantity: data.inventory,
          category_name: data.category,
          tags: data.tags,
          is_active: data.isActive,
        },
      }),
      transform: (response: z.infer<typeof apiProductSchema>) => ({
        id: response.product_id,
        sku: response.sku,
        name: response.product_name,
        description: response.product_description,
        price: response.price_cents / 100,
        currency: response.currency_code,
        inventory: response.stock_quantity,
        category: response.category_name,
        tags: response.tags,
        isActive: response.is_active,
        createdAt: response.created_at,
        updatedAt: response.updated_at,
      }),
      extract: (item) => ({
        externalId: item.id,
        externalUpdatedAt: item.updatedAt,
      }),
    })
  )
  .update(
    createUpdateConfig<Product>({
      request: (id, data) => ({
        endpoint: `/products/${id}`,
        method: "PATCH",
        json: {
          // Only send fields that are being updated
          ...(data.name && { product_name: data.name }),
          ...(data.description && { product_description: data.description }),
          ...(data.price !== undefined && {
            price_cents: Math.round(data.price * 100),
          }),
          ...(data.inventory !== undefined && {
            stock_quantity: data.inventory,
          }),
          ...(data.category && { category_name: data.category }),
          ...(data.tags && { tags: data.tags }),
          ...(data.isActive !== undefined && { is_active: data.isActive }),
        },
      }),
      transform: (response: z.infer<typeof apiProductSchema>) => ({
        id: response.product_id,
        sku: response.sku,
        name: response.product_name,
        description: response.product_description,
        price: response.price_cents / 100,
        currency: response.currency_code,
        inventory: response.stock_quantity,
        category: response.category_name,
        tags: response.tags,
        isActive: response.is_active,
        createdAt: response.created_at,
        updatedAt: response.updated_at,
      }),
      extract: (item) => ({
        externalUpdatedAt: item.updatedAt,
      }),
    })
  )
  .delete(
    createDeleteConfig({
      request: (id) => ({
        endpoint: `/products/${id}`,
        method: "DELETE",
      }),
    })
  )
  .batchCreate({
    payloadType: "items",
    request: (items) => ({
      endpoint: "/products/batch",
      method: "POST",
      json: {
        products: items.map((item) => ({
          sku: item.sku,
          product_name: item.name,
          product_description: item.description,
          price_cents: Math.round(item.price * 100),
          currency_code: item.currency,
          stock_quantity: item.inventory,
          category_name: item.category,
          tags: item.tags,
          is_active: item.isActive,
        })),
      },
    }),
    batchSize: 50,
  })
  .batchUpdate({
    payloadType: "items",
    request: (items) => ({
      endpoint: "/products/batch-update",
      method: "PATCH",
      json: {
        updates: items.map((item) => ({
          product_id: item.id,
          data: item.data,
        })),
      },
    }),
    batchSize: 50,
  })
  .batchDelete({
    payloadType: "ids",
    request: (ids) => ({
      endpoint: "/products/batch-delete",
      method: "POST",
      json: { product_ids: ids },
    }),
    batchSize: 100,
  })
  .build();

// Usage example demonstrating all CRUD operations
async function useProductModelConnector() {
  // List products
  if (productModelConnector.list) {
    const { items } = await productModelConnector.list({
      page: 1,
      limit: 50,
      syncType: "FULL",
    } as any);

    items.forEach(({ data }) => {
      console.log(`Product: ${data.name} (${data.sku})`);
      console.log(`Price: $${data.price} ${data.currency}`);
      console.log(`Inventory: ${data.inventory} units`);
    });
  }

  // Create a product
  if (productModelConnector.create) {
    const newProduct = await productModelConnector.create({
      id: "temp", // Server will assign
      sku: "WIDGET-001",
      name: "Super Widget",
      description: "The best widget ever made",
      price: 99.99,
      currency: "USD",
      inventory: 100,
      category: "Widgets",
      tags: ["new", "featured"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log(`Created product: ${newProduct.id}`);
  }

  // Update a product
  if (productModelConnector.update) {
    const updatedProduct = await productModelConnector.update("prod-123", {
      price: 89.99,
      inventory: 95,
      tags: ["sale", "featured"],
    });

    console.log(`Updated product: ${updatedProduct.name}`);
  }

  // Bulk operations
  if (productModelConnector.batchCreate) {
    const products: Product[] = [
      {
        id: "temp1",
        sku: "WIDGET-002",
        name: "Widget Pro",
        description: "Professional grade widget",
        price: 149.99,
        currency: "USD",
        inventory: 50,
        category: "Widgets",
        tags: ["pro"],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "temp2",
        sku: "WIDGET-003",
        name: "Widget Lite",
        description: "Entry level widget",
        price: 49.99,
        currency: "USD",
        inventory: 200,
        category: "Widgets",
        tags: ["budget"],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const createdProducts = await productModelConnector.batchCreate(products);
    console.log(`Created ${createdProducts.length} products in batch`);
  }

  // Delete a product
  if (productModelConnector.delete) {
    await productModelConnector.delete("prod-456");
    console.log("Product deleted");
  }

  // Bulk delete
  if (productModelConnector.batchDelete) {
    await productModelConnector.batchDelete(["prod-789", "prod-012"]);
    console.log("Products deleted in batch");
  }
}

// Export usage functions for testing
export {
  useBasicModelConnector,
  useContactModelConnector,
  useUserModelConnector,
  useProductModelConnector,
};
