import { defineCrmCollection, type Infer } from "../src";

// Define the built-in CRM collection using the SDK helper
const crmCollection = defineCrmCollection().deploy();

// Infer types for a couple of models from the deployed collection
type Contact = Infer<typeof crmCollection, "contact">;
type Account = Infer<typeof crmCollection, "account">;

// Positive example usages of inferred types
const aContact: Contact = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  phone: null,
  mobile: null,
  address: null,
  mailingAddress: null,
  otherAddress: null,
  accountId: null,
  ownerId: null,
};

const anAccount: Account = {
  name: "Acme Inc",
  website: "https://acme.example",
  phone: null,
  address: null,
  billingAddress: null,
  shippingAddress: null,
  industry: null,
  numberOfEmployees: null,
  ownerId: null,
};

void aContact;
void anAccount;

export { crmCollection };
