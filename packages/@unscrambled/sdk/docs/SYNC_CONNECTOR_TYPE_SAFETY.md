# Sync Connector Type Safety

This document explains the type safety features available in sync connectors, particularly for transform functions.

## Overview

Sync connectors now provide full type safety for transform functions, ensuring that:

1. The transform function receives the full API response, typed with the response schema
2. The transform must return an array of objects that match the collection's model schema
3. TypeScript will catch type mismatches at compile time
4. You have full control over how to extract items from complex API responses

## Type-Safe Transform Methods

### Using `createListConfig` Helper

The `createListConfig` helper provides the best type inference:

```typescript
import { createListConfig } from "@unscrambled/sdk";

// Define your API response schema
const apiListResponseSchema = z.object({
  customers: z.array(
    z.object({
      customer_id: z.string(),
      full_name: z.string(),
      email_address: z.string(),
      is_active: z.boolean(),
    })
  ),
  total: z.number(),
  page: z.number(),
});

type ApiListResponse = z.infer<typeof apiListResponseSchema>;

// Define your collection model type
interface Customer {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

// Create type-safe list configuration
const listConfig = createListConfig<Customer, ApiListResponse>({
  request: (params) => ({
    endpoint: "/customers",
    method: "GET",
    params: {
      page: params.page || 1,
      limit: params.limit || 20,
    },
  }),
  responseSchema: apiListResponseSchema,
  // Transform receives the full response object
  // Must return an array of Customer objects
  transform: (response) => {
    // You have access to the entire response structure
    console.log(`Total customers: ${response.total}`);

    // Map the customers array to your model format
    return response.customers.map((apiCustomer) => ({
      id: apiCustomer.customer_id,
      name: apiCustomer.full_name,
      email: apiCustomer.email_address,
      active: apiCustomer.is_active,
    }));
  },
});
```

### Using Builder Pattern with `list`

The builder pattern also provides type safety:

```typescript
const syncConnector = createSyncConnector(restConnector, collection)
  .add("customer", (builder) =>
    builder.list({
      request: (params) => ({
        endpoint: "/customers",
        params: {
          page: params.page || 1,
          limit: params.limit || 20,
        },
      }),
      responseSchema: customerListResponseSchema,
      // Transform receives the full response
      transform: (response) => {
        // Handle paginated responses
        return response.data.map((customer) => ({
          id: customer.customer_id,
          name: customer.full_name,
          email: customer.email_address,
          status: customer.is_active ? "active" : "inactive",
        }));
      },
    })
  )
  .build();
```

### Inline Configuration with Type Annotations

You can also use explicit type annotations for clarity:

```typescript
const syncConnector = createSyncConnector(restConnector, collection)
  .with("customer", {
    list: {
      request: (params) => ({
        endpoint: "/customers",
        method: "GET",
        params: {
          page: params.page || 1,
          limit: params.limit || 20,
        },
      }),
      responseSchema: customerListResponseSchema,
      // Explicit type annotations
      transform: (response: CustomerListResponse): Customer[] => {
        return response.customers.map((customer) => ({
          id: customer.customer_id,
          name: customer.full_name,
          email: customer.email_address,
          status: customer.is_active ? "active" : "inactive",
        }));
      },
    },
  })
  .build();
```

## Type Safety Benefits

### Compile-Time Error Detection

TypeScript will catch errors if:

- You try to access properties that don't exist on the API response
- The transform function doesn't return the correct model type
- Required properties are missing from the transformed object
- Property types don't match between API response and model

### IntelliSense Support

Your IDE will provide:

- Auto-completion for API response properties in the transform function
- Type hints for all properties
- Error highlighting for type mismatches

### Example: Type Errors

```typescript
// This will cause a TypeScript error - not returning an array
const badConfig = createListConfig<Customer, ApiListResponse>({
  request: (params) => ({
    endpoint: "/customers",
  }),
  responseSchema: apiListResponseSchema,
  transform: (response) => {
    // Error: Must return Customer[], not Customer
    return {
      id: "1",
      name: "test",
      email: "test@example.com",
      active: true,
    };
  },
});

// This will also cause an error - missing required properties
const badConfig2 = createListConfig<Customer, ApiListResponse>({
  request: (params) => ({
    endpoint: "/customers",
  }),
  responseSchema: apiListResponseSchema,
  transform: (response) => {
    return response.customers.map((customer) => ({
      // Error: Property 'id' is missing
      name: customer.full_name,
      email: customer.email_address,
      active: customer.is_active,
    }));
  },
});
```

## Best Practices

1. **Always define response schemas**: Use Zod schemas to define the complete shape of API responses, including pagination metadata
2. **Use type-safe helpers**: Prefer `createListConfig` or the builder `list` method for better type inference
3. **Handle nested data**: The transform function receives the full response, so you can handle complex nested structures
4. **Keep transforms simple**: Transform functions should focus on data mapping, not business logic
5. **Document response structures**: Add comments explaining the expected API response format

## Common Patterns

### Cursor-Based Pagination

```typescript
const cursorListConfig = createListConfig<Item, CursorResponse>({
  request: (params) => ({
    endpoint: "/items",
    params: {
      cursor: params.cursor,
      limit: params.limit || 50,
    },
  }),
  responseSchema: cursorResponseSchema,
  pagination: ({ response }) => ({
    cursor: response.nextCursor ?? null,
    page: null,
    offset: null,
    hasMore: !!response.nextCursor,
  }),
  transform: (response) => response.items,
});
```

### Page-Based Pagination (map provider paging to cursor)

```typescript
const pageListConfig = createListConfig<Item, PagedResponse>({
  request: (params) => ({
    endpoint: "/items",
    params: {
      page: params.page || 1,
      per_page: params.limit || 20,
    },
  }),
  responseSchema: pagedResponseSchema,
  // Convert provider paging to a synthetic cursor: stop when hasMore is false
  pagination: ({ response }) => ({
    cursor: response.hasMore ? String(response.page + 1) : null,
    page: response.hasMore ? response.page + 1 : null,
    offset: null,
    hasMore: !!response.hasMore,
  }),
  transform: (response) => response.data,
});
```

### Offset-Based Pagination (map to cursor)

```typescript
const offsetListConfig = createListConfig<Item, OffsetResponse>({
  request: (params) => ({
    endpoint: "/items",
    params: {
      offset: params.offset || 0,
      limit: params.limit || 100,
    },
  }),
  responseSchema: offsetResponseSchema,
  // Convert offset scheme to a synthetic cursor by encoding next offset
  pagination: ({ response }) => ({
    cursor: response.results.length
      ? String((response.offset ?? 0) + (response.limit ?? 100))
      : null,
    page: null,
    offset: response.results.length
      ? (response.offset ?? 0) + (response.limit ?? 100)
      : null,
    hasMore: response.results.length > 0,
  }),
  transform: (response) => response.results,
});
```

### Wrapped Responses

```typescript
const wrappedResponseSchema = z.object({
  success: z.boolean(),
  result: z.array(itemSchema),
  metadata: z.object({
    /* ... */
  }),
});

// Transform extracts items from result field
transform: (response) => response.result;
```

### Simple Array Responses

```typescript
const arrayResponseSchema = z.array(itemSchema);

// Transform can add computed properties
transform: (items) =>
  items.map((item) => ({
    ...item,
    computed: calculateValue(item),
  }));
```

## Dynamic Request Creation

All request configurations are now functions that receive the appropriate data and return the request configuration. This enables dynamic request creation based on runtime data:

### List Requests

```typescript
const listConfig = {
  list: {
    request: (params: ListParams) => ({
      endpoint: "/api/customers",
      method: "GET",
      params: {
        page: params.page || 1,
        limit: params.limit || 50,
        cursor: params.cursor,
      },
    }),
    // ...
  },
};
```

### Create Requests

```typescript
const createConfig = {
  create: {
    request: (data: Customer) => ({
      endpoint: "/api/customers",
      method: "POST",
      data: {
        // Can transform or validate data before sending
        ...data,
        created_at: new Date().toISOString(),
      },
    }),
    // ...
  },
};
```

### Update Requests

```typescript
const updateConfig = {
  update: {
    request: (id: string, data: Partial<Customer>) => ({
      endpoint: `/api/customers/${id}`,
      method: "PATCH",
      data,
    }),
    // ...
  },
};
```

### Delete Requests

```typescript
const deleteConfig = {
  delete: {
    request: (id: string) => ({
      endpoint: `/api/customers/${id}`,
      method: "DELETE",
    }),
  },
};
```

### Bulk Operations

```typescript
const batchConfig = {
  batch: {
    create: {
      request: (items: Customer[]) => ({
      endpoint: "/api/customers/batch",
        method: "POST",
        data: { customers: items },
      }),
      batchSize: 100,
    },
    update: {
      request: (items: Array<{ id: string; data: Partial<Customer> }>) => ({
      endpoint: "/api/customers/batch-update",
        method: "PATCH",
        data: { updates: items },
      }),
      batchSize: 50,
    },
    delete: {
      request: (ids: string[]) => ({
      endpoint: "/api/customers/batch-delete",
        method: "POST",
        data: { ids },
      }),
      batchSize: 200,
    },
  },
};
```

When working with sync push changes you can opt into the change-aware helper,
which receives the full change (including `changeId`) and extracts the
confirmation payload from the API response:

```typescript
builder.withBatchCreate({
  request: (changes) => ({
    endpoint: "/objects/contacts/batch/create",
    method: "POST",
  json: {
      inputs: changes.map((change) => ({
        objectWriteTraceId: change.changeId,
        properties: {
          firstname: change.obj.firstName,
          lastname: change.obj.lastName,
          email: change.obj.email,
        },
      })),
    },
  }),
  responseSchema: z.object({
    results: z.array(
      z.object({
        objectWriteTraceId: z.string(),
        id: z.string(),
        updatedAt: z.string(),
      })
    ),
  }),
  extract: (response) =>
    response.results.map((result) => ({
      changeId: result.objectWriteTraceId,
      externalId: result.id,
      externalUpdatedAt: result.updatedAt,
    })),
});

builder.withBatchUpdate({
  request: (changes) => ({
    endpoint: "/objects/contacts/batch/update",
    method: "POST",
    json: {
      inputs: changes.map((change) => ({
        objectWriteTraceId: change.changeId,
        id: change.externalId,
        properties: {
          firstname: change.obj.firstName,
          lastname: change.obj.lastName,
          email: change.obj.email,
        },
      })),
    },
  }),
  responseSchema: z.object({
    results: z.array(
      z.object({
        objectWriteTraceId: z.string(),
        id: z.string(),
        updatedAt: z.string(),
      })
    ),
  }),
  extract: (response) =>
    response.results.map((result) => ({
      changeId: result.objectWriteTraceId,
      externalId: result.id,
      externalUpdatedAt: result.updatedAt,
    })),
});

builder.withBatchDelete({
  request: (changes) => ({
    endpoint: "/objects/contacts/batch/delete",
    method: "POST",
    json: {
      inputs: changes.map((change) => ({
        objectWriteTraceId: change.changeId,
        id: change.externalId,
      })),
    },
  }),
});
```

## Migration Guide

If you have existing sync connectors without type safety:

1. Define Zod schemas for your API responses
2. Replace generic list configurations with type-safe versions
3. Add type annotations to transform functions
4. Fix any TypeScript errors that appear

Before:

```typescript
.with("customer", {
  list: {
    endpoint: "/customers",
    transform: (item: any) => ({
      id: item.customer_id,
      name: item.full_name,
    }),
  },
})
```

After:

```typescript
.with("customer", {
  list: createListConfig<Customer, ApiListResponse>({
    request: (params) => ({
      endpoint: "/customers",
      params: {
        page: params.page || 1,
      },
    }),
    responseSchema: apiListResponseSchema,
    transform: (response) => {
      return response.customers.map((customer) => ({
        id: customer.customer_id,
        name: customer.full_name,
      }));
    },
  }),
})
```
