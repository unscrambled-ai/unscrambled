export type WebhookSubscriptionType =
  /**
   * Get notified if any contact is created in a customer's account.
   */
  | "contact.creation"
  /**
   * Get notified if any contact is deleted in a customer's account.
   */
  | "contact.deletion"
  /**
   * Get notified if a contact is merged with another.
   */
  | "contact.merge"
  /**
   * Get notified if a contact has an association added or removed between itself and another supported webhook object (contact, company, deal, ticket, line item, or product).
   */
  | "contact.associationChange"
  /**
   * Get notified if a contact is restored from deletion.
   */
  | "contact.restore"
  /**
   * Get notified if a contact is deleted for privacy compliance reasons.
   */
  | "contact.privacyDeletion"
  /**
   * Get notified if a specified property is changed for any contact in an account.
   */
  | "contact.propertyChange"
  /**
   * Get notified if any company is created in a customer's account.
   */
  | "company.creation"
  /**
   * Get notified if any company is deleted in a customer's account.
   */
  | "company.deletion"
  /**
   * Get notified if a specified property is changed for any company in a customer's account.
   */
  | "company.propertyChange"
  /**
   * Get notified if a company has an association added or removed between itself and another supported webhook object (contact, company, deal, ticket, line item, or product).
   */
  | "company.associationChange"
  /**
   * Get notified if a company is restored from deletion.
   */
  | "company.restore"
  /**
   * Get notified if a company is merged with another.
   */
  | "company.merge"
  /**
   * Get notified if any deal is created in a customer's account.
   */
  | "deal.creation"
  /**
   * Get notified if any deal is deleted in a customer's account.
   */
  | "deal.deletion"
  /**
   * Get notified if a deal has an association added or removed between itself and another supported webhook object (contact, company, deal, ticket, line item, or product).
   */
  | "deal.associationChange"
  /**
   * Get notified if a deal is restored from deletion.
   */
  | "deal.restore"
  /**
   * Get notified if a deal is merged with another.
   */
  | "deal.merge"
  /**
   * Get notified if a specified property is changed for any deal in a customer's account.
   */
  | "deal.propertyChange"
  /**
   * Get notified if a ticket is created in a customer's account.
   */
  | "ticket.creation"
  /**
   * Get notified if any ticket is deleted in a customer's account.
   */
  | "ticket.deletion"
  /**
   * Get notified if a specified property is changed for any ticket in a customer's account.
   */
  | "ticket.propertyChange"
  /**
   * Get notified if a ticket has an association added or removed between itself and another supported webhook object (contact, company, deal, ticket, line item, or product).
   */
  | "ticket.associationChange"
  /**
   * Get notified if a ticket is restored from deletion.
   */
  | "ticket.restore"
  /**
   * Get notified if a ticket is merged with another.
   */
  | "ticket.merge"
  /**
   * Get notified if any product is created in a customer's account.
   */
  | "product.creation"
  /**
   * Get notified if any product is deleted in a customer's account.
   */
  | "product.deletion"
  /**
   * Get notified if a product is restored from deletion.
   */
  | "product.restore"
  /**
   * Get notified if a product is merged with another.
   */
  | "product.merge"
  /**
   * Get notified if a specified product is changed for any product in a customer's account.
   */
  | "product.propertyChange"
  /**
   * Get notified if any line item is created in a customer's account.
   */
  | "line_item.creation"
  /**
   * Get notified if any line item is deleted in a customer's account.
   */
  | "line_item.deletion"
  /**
   * Get notified if a line item has an association added or removed between itself and another supported webhook object (contact, company, deal, ticket, line item, or product).
   */
  | "line_item.associationChange"
  /**
   * Get notified if a line item is restored from deletion.
   */
  | "line_item.restore"
  /**
   * Get notified if a line item is merged with another.
   */
  | "line_item.merge"
  /**
   * Get notified if a specified property is changed for any line item in a customer's account.
   */
  | "line_item.propertyChange";
