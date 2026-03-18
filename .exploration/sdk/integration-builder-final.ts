import { CustomApp } from './app-types';
import { Collection } from './types';

/**
 * Final integration builder with name, title, and app configuration
 */

export interface Integration {
  name: string;
  title?: string;
  app: {
    type: 'builtin' | 'custom';
    name: string;
    definition?: CustomApp;
  };
  collections: Record<string, Collection>;
}

export class IntegrationBuilder {
  private name: string;
  private title?: string;
  private app?: Integration['app'];
  private collections: Record<string, Collection> = {};

  constructor(name: string) {
    this.name = name;
  }

  withTitle(title: string): this {
    this.title = title;
    return this;
  }

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
      name: this.name,
      title: this.title,
      app: this.app,
      collections: this.collections
    };
  }
}

export function defineIntegration(name: string): IntegrationBuilder {
  return new IntegrationBuilder(name);
}