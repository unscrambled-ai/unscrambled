import { CustomApp } from './app-types';
import { Collection } from './types';

/**
 * Integration builder with separate methods for built-in and custom apps
 */

export interface Integration {
  app: {
    type: 'builtin' | 'custom';
    name: string;
    definition?: CustomApp;
  };
  collections: Record<string, Collection>;
}

export class IntegrationBuilder {
  private app?: Integration['app'];
  private collections: Record<string, Collection> = {};

  /**
   * Use a built-in app provided by Unscrambled
   */
  withApp(appName: string): this {
    this.app = {
      type: 'builtin',
      name: appName
    };
    return this;
  }

  /**
   * Use a custom app defined in your code
   */
  withCustomApp(customApp: CustomApp): this {
    this.app = {
      type: 'custom',
      name: customApp.name,
      definition: customApp
    };
    return this;
  }

  withCollection(name: string, collection: Collection): this {
    this.collections[name] = collection;
    return this;
  }

  withCollections(collections: Record<string, Collection>): this {
    Object.assign(this.collections, collections);
    return this;
  }

  build(): Integration {
    if (!this.app) {
      throw new Error('Integration requires an app. Use .withApp() for built-in apps or .withCustomApp() for custom apps.');
    }
    
    return {
      app: this.app,
      collections: this.collections
    };
  }
}

export function defineIntegration(): IntegrationBuilder {
  return new IntegrationBuilder();
}