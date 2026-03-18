import type {
  Collection,
  Model,
  CustomApp,
  Integration,
  Action,
} from "../types";

/**
 * Registry entry types for different SDK elements
 */
export interface RegistryEntry {
  id: string;
  name: string;
  type: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface ModelRegistryEntry extends RegistryEntry {
  type: "model";
  model: Model;
}

export interface CollectionRegistryEntry extends RegistryEntry {
  type: "collection";
  collection: Collection;
}

export interface CustomAppRegistryEntry extends RegistryEntry {
  type: "customApp";
  customApp: CustomApp;
}

export interface IntegrationRegistryEntry extends RegistryEntry {
  type: "integration";
  integration: Integration;
}

export interface ActionRegistryEntry extends RegistryEntry {
  type: "action";
  action: Action;
}

export type RegistryItem =
  | ModelRegistryEntry
  | CollectionRegistryEntry
  | CustomAppRegistryEntry
  | IntegrationRegistryEntry
  | ActionRegistryEntry;

/**
 * Main registry class that tracks all SDK elements
 */
class SDKRegistry {
  private items: Map<string, RegistryItem> = new Map();
  private itemsByType: Map<string, RegistryItem[]> = new Map();

  /**
   * Register a model in the registry
   */
  registerModel(model: Model, metadata?: Record<string, any>): string {
    const id = this.generateId("model", model.name);
    const entry: ModelRegistryEntry = {
      id,
      name: model.name,
      type: "model",
      model,
      createdAt: new Date(),
      metadata,
    };

    this.addEntry(entry);
    return id;
  }

  /**
   * Register a collection in the registry
   */
  registerCollection(
    collection: Collection,
    metadata?: Record<string, any>
  ): string {
    const id = this.generateId("collection", collection.name);
    const entry: CollectionRegistryEntry = {
      id,
      name: collection.name,
      type: "collection",
      collection,
      createdAt: new Date(),
      metadata,
    };

    this.addEntry(entry);
    return id;
  }

  /**
   * Register a custom app in the registry
   */
  registerCustomApp(
    customApp: CustomApp,
    metadata?: Record<string, any>
  ): string {
    const id = this.generateId("customApp", customApp.name);
    const entry: CustomAppRegistryEntry = {
      id,
      name: customApp.name,
      type: "customApp",
      customApp,
      createdAt: new Date(),
      metadata,
    };

    this.addEntry(entry);
    return id;
  }

  /**
   * Register an integration in the registry
   */
  registerIntegration(
    integration: Integration,
    metadata?: Record<string, any>
  ): string {
    const id = this.generateId("integration", integration.name);
    const entry: IntegrationRegistryEntry = {
      id,
      name: integration.name,
      type: "integration",
      integration,
      createdAt: new Date(),
      metadata,
    };

    this.addEntry(entry);
    return id;
  }

  /**
   * Register an action in the registry
   */
  registerAction(action: Action, metadata?: Record<string, any>): string {
    const id = this.generateId("action", action.name);
    const entry: ActionRegistryEntry = {
      id,
      name: action.name,
      type: "action",
      action,
      createdAt: new Date(),
      metadata,
    };

    this.addEntry(entry);
    return id;
  }

  /**
   * Get all registered items
   */
  getAllItems(): RegistryItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Get items by type
   */
  getItemsByType<T extends RegistryItem>(type: string): T[] {
    return (this.itemsByType.get(type) || []) as T[];
  }

  /**
   * Get all models
   */
  getModels(): ModelRegistryEntry[] {
    return this.getItemsByType<ModelRegistryEntry>("model");
  }

  /**
   * Get all collections
   */
  getCollections(): CollectionRegistryEntry[] {
    return this.getItemsByType<CollectionRegistryEntry>("collection");
  }

  /**
   * Get all custom apps
   */
  getCustomApps(): CustomAppRegistryEntry[] {
    return this.getItemsByType<CustomAppRegistryEntry>("customApp");
  }

  /**
   * Get all integrations
   */
  getIntegrations(): IntegrationRegistryEntry[] {
    return this.getItemsByType<IntegrationRegistryEntry>("integration");
  }

  /**
   * Get all actions
   */
  getActions(): ActionRegistryEntry[] {
    return this.getItemsByType<ActionRegistryEntry>("action");
  }

  /**
   * Get a specific item by id
   */
  getItem(id: string): RegistryItem | undefined {
    return this.items.get(id);
  }

  /**
   * Get items by name
   */
  getItemsByName(name: string): RegistryItem[] {
    return Array.from(this.items.values()).filter((item) => item.name === name);
  }

  /**
   * Clear the registry (useful for testing)
   */
  clear(): void {
    this.items.clear();
    this.itemsByType.clear();
  }

  /**
   * Get registry statistics
   */
  getStats() {
    const stats: Record<string, number> = {};

    this.itemsByType.forEach((items, type) => {
      stats[type] = items.length;
    });

    return {
      totalItems: this.items.size,
      byType: stats,
      createdAt: new Date(),
    };
  }

  /**
   * Export registry data for deployment
   */
  export() {
    return {
      items: this.getAllItems(),
      stats: this.getStats(),
      exportedAt: new Date(),
    };
  }

  private addEntry(entry: RegistryItem): void {
    this.items.set(entry.id, entry);

    if (!this.itemsByType.has(entry.type)) {
      this.itemsByType.set(entry.type, []);
    }
    this.itemsByType.get(entry.type)!.push(entry);
  }

  private generateId(type: string, name: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${type}_${name}_${timestamp}_${random}`;
  }
}

// Global registry instance
const registry = new SDKRegistry();

/**
 * Public API functions
 */

/**
 * Get the global registry instance
 */
export function getRegistry(): SDKRegistry {
  return registry;
}

/**
 * Register a model
 */
export function registerModel(
  model: Model,
  metadata?: Record<string, any>
): string {
  return registry.registerModel(model, metadata);
}

/**
 * Register a collection
 */
export function registerCollection(
  collection: Collection,
  metadata?: Record<string, any>
): string {
  return registry.registerCollection(collection, metadata);
}

/**
 * Register a custom app
 */
export function registerCustomApp(
  customApp: CustomApp,
  metadata?: Record<string, any>
): string {
  return registry.registerCustomApp(customApp, metadata);
}

/**
 * Register an integration
 */
export function registerIntegration(
  integration: Integration,
  metadata?: Record<string, any>
): string {
  return registry.registerIntegration(integration, metadata);
}

/**
 * Register an action
 */
export function registerAction(
  action: Action,
  metadata?: Record<string, any>
): string {
  return registry.registerAction(action, metadata);
}

/**
 * Get all registered models
 */
export function getModels(): ModelRegistryEntry[] {
  return registry.getModels();
}

/**
 * Get all registered collections
 */
export function getCollections(): CollectionRegistryEntry[] {
  return registry.getCollections();
}

/**
 * Get all registered custom apps
 */
export function getCustomApps(): CustomAppRegistryEntry[] {
  return registry.getCustomApps();
}

/**
 * Get all registered integrations
 */
export function getIntegrations(): IntegrationRegistryEntry[] {
  return registry.getIntegrations();
}

/**
 * Get all registered actions
 */
export function getActions(): ActionRegistryEntry[] {
  return registry.getActions();
}

/**
 * Get all registered items
 */
export function getAllItems(): RegistryItem[] {
  return registry.getAllItems();
}

/**
 * Export the entire registry for deployment
 */
export function exportRegistry() {
  return registry.export();
}

/**
 * Clear the registry (for testing)
 */
export function clearRegistry(): void {
  registry.clear();
}

/**
 * Get registry statistics
 */
export function getRegistryStats() {
  return registry.getStats();
}
