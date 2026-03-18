import { defineCollection } from "../builders";
import type { Model } from "../types";
import type { FromSchema } from "json-schema-to-ts";

export interface DefineCrmCollectionProps {
  name?: string;
  title?: string;
  models?: Model<any, any>[];
}

const CrmEmailJsonSchema = { type: ["string", "null"] } as const;

const CrmPhoneJsonSchema = { type: ["string", "null"] } as const;

const CrmAddressJsonSchema = {
  anyOf: [
    {
      type: "object",
      properties: {
        type: { type: ["string", "null"] },
        street: { type: ["string", "null"] },
        street2: { type: ["string", "null"] },
        city: { type: ["string", "null"] },
        state: { type: ["string", "null"] },
        postalCode: { type: ["string", "null"] },
        country: { type: ["string", "null"] },
      },
      additionalProperties: false,
    },
    { type: "null" },
  ],
} as const;

export const CrmUserJsonSchema = {
  type: "object",
  properties: {
    username: { type: ["string", "null"] },
    email: CrmEmailJsonSchema,
    firstName: { type: ["string", "null"] },
    lastName: { type: ["string", "null"] },
  },
  additionalProperties: false,
} as const;

export const CrmAccountJsonSchema = {
  type: "object",
  properties: {
    name: { type: ["string", "null"] },
    website: { type: ["string", "null"] },
    phone: CrmPhoneJsonSchema,
    address: CrmAddressJsonSchema,
    billingAddress: CrmAddressJsonSchema,
    shippingAddress: CrmAddressJsonSchema,
    industry: { type: ["string", "null"] },
    numberOfEmployees: { type: ["string", "null"] },
    ownerId: {
      anyOf: [
        {
          type: "string",
          references: "user",
        },
        { type: "null" },
      ],
    },
  },
  additionalProperties: false,
} as const;

export const CrmContactJsonSchema = {
  type: "object",
  properties: {
    firstName: { type: ["string", "null"] },
    lastName: { type: ["string", "null"] },
    title: { type: ["string", "null"] },
    email: CrmEmailJsonSchema,
    phone: CrmPhoneJsonSchema,
    mobile: CrmPhoneJsonSchema,
    address: CrmAddressJsonSchema,
    mailingAddress: CrmAddressJsonSchema,
    otherAddress: CrmAddressJsonSchema,
    accountId: {
      anyOf: [
        {
          type: "string",
          references: "account",
        },
        { type: "null" },
      ],
    },
    ownerId: {
      anyOf: [
        {
          type: "string",
          references: "user",
        },
        { type: "null" },
      ],
    },
  },
  additionalProperties: false,
} as const;

export const CrmOpportunityJsonSchema = {
  type: "object",
  properties: {
    name: { type: ["string", "null"] },
    amount: { type: ["string", "null"] },
    closeDate: { type: ["string", "null"] },
    stage: { type: ["string", "null"] },
    accountId: {
      anyOf: [
        {
          type: "string",
          references: "account",
        },
        { type: "null" },
      ],
    },
    ownerId: {
      anyOf: [
        {
          type: "string",
          references: "user",
        },
        { type: "null" },
      ],
    },
  },
  additionalProperties: false,
} as const;

export const CrmLeadJsonSchema = {
  type: "object",
  properties: {
    firstName: { type: ["string", "null"] },
    lastName: { type: ["string", "null"] },
    email: CrmEmailJsonSchema,
    phone: CrmPhoneJsonSchema,
    mobile: CrmPhoneJsonSchema,
    address: CrmAddressJsonSchema,
    mailingAddress: CrmAddressJsonSchema,
    otherAddress: CrmAddressJsonSchema,
    ownerId: {
      anyOf: [
        {
          type: "string",
          references: "user",
        },
        { type: "null" },
      ],
    },
  },
  additionalProperties: false,
} as const;

export const CrmCallJsonSchema = {
  type: "object",
  properties: {
    subject: { type: ["string", "null"] },
    content: { type: ["string", "null"] },
    timestamp: { type: ["string", "null"] },
    duration: { type: ["string", "null"] },
  },
  additionalProperties: false,
} as const;

export const CrmTaskJsonSchema = {
  type: "object",
  properties: {
    subject: { type: ["string", "null"] },
    content: { type: ["string", "null"] },
    dueDate: { type: ["string", "null"] },
    status: { type: ["string", "null"] },
    completedDate: { type: ["string", "null"] },
  },
  additionalProperties: false,
} as const;

export const CrmMeetingJsonSchema = {
  type: "object",
  properties: {
    subject: { type: ["string", "null"] },
    content: { type: ["string", "null"] },
    startTime: { type: ["string", "null"] },
    endTime: { type: ["string", "null"] },
  },
  additionalProperties: false,
} as const;

export const CrmNoteJsonSchema = {
  type: "object",
  properties: {
    title: { type: ["string", "null"] },
    content: { type: ["string", "null"] },
    timestamp: { type: ["string", "null"] },
    accountId: {
      anyOf: [
        {
          type: "string",
          references: "account",
        },
        { type: "null" },
      ],
    },
    contactId: {
      anyOf: [
        {
          type: "string",
          references: "contact",
        },
        { type: "null" },
      ],
    },
    opportunityId: {
      anyOf: [
        {
          type: "string",
          references: "opportunity",
        },
        { type: "null" },
      ],
    },
  },
  additionalProperties: false,
} as const;

export const CrmProductJsonSchema = {
  type: "object",
  properties: {
    name: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    price: { type: ["string", "null"] },
    code: { type: ["string", "null"] },
  },
  additionalProperties: false,
} as const;

export const CrmOpportunityLineItemJsonSchema = {
  type: "object",
  properties: {
    name: { type: ["string", "null"] },
    quantity: { type: ["string", "null"] },
    price: { type: ["string", "null"] },
    opportunityId: {
      anyOf: [
        {
          type: "string",
          references: "opportunity",
        },
        { type: "null" },
      ],
    },
    productId: {
      anyOf: [
        {
          type: "string",
          references: "product",
        },
        { type: "null" },
      ],
    },
  },
  additionalProperties: false,
} as const;

export type CrmUserData = FromSchema<typeof CrmUserJsonSchema>;
export type CrmAccountData = FromSchema<typeof CrmAccountJsonSchema>;
export type CrmContactData = FromSchema<typeof CrmContactJsonSchema>;
export type CrmOpportunityData = FromSchema<typeof CrmOpportunityJsonSchema>;
export type CrmLeadData = FromSchema<typeof CrmLeadJsonSchema>;
export type CrmCallData = FromSchema<typeof CrmCallJsonSchema>;
export type CrmTaskData = FromSchema<typeof CrmTaskJsonSchema>;
export type CrmMeetingData = FromSchema<typeof CrmMeetingJsonSchema>;
export type CrmNoteData = FromSchema<typeof CrmNoteJsonSchema>;
export type CrmProductData = FromSchema<typeof CrmProductJsonSchema>;
export type CrmOpportunityLineItemData = FromSchema<
  typeof CrmOpportunityLineItemJsonSchema
>;

export function defineCrmCollection(props: DefineCrmCollectionProps = {}) {
  const { name = "crm", title = "CRM", models = [] } = props;

  const builder = defineCollection(name)
    .withTitle(title)
    .addModel("user", {
      title: "User",
      schema: CrmUserJsonSchema,
    })
    .addModel("account", {
      title: "Account",
      schema: CrmAccountJsonSchema,
      matchPattern: "name",
    })
    .addModel("contact", {
      title: "Contact",
      schema: CrmContactJsonSchema,
      matchPattern: "email",
    })
    .addModel("opportunity", {
      title: "Opportunity",
      schema: CrmOpportunityJsonSchema,
    })
    .addModel("lead", {
      title: "Lead",
      schema: CrmLeadJsonSchema,
      matchPattern: "email",
    })
    .addModel("call", {
      title: "Call",
      schema: CrmCallJsonSchema,
    })
    .addModel("task", {
      title: "Task",
      schema: CrmTaskJsonSchema,
    })
    .addModel("meeting", {
      title: "Meeting",
      schema: CrmMeetingJsonSchema,
    })
    .addModel("note", {
      title: "Note",
      schema: CrmNoteJsonSchema,
    })
    .addModel("product", {
      title: "Product",
      schema: CrmProductJsonSchema,
    })
    .addModel("opportunityLineItem", {
      title: "Opportunity Line Item",
      schema: CrmOpportunityLineItemJsonSchema,
    });

  if (models && models.length > 0) {
    builder.withModels(models);
  }

  return builder;
}
