import {
  OAuthConnector,
  OAuthConnectorProps,
  OAuthConnectorBaseUrls,
} from "../connectors/OAuthConnector";

/**
 * Function to extract custom data from OAuth token response
 */
export type ExtraDataExtractor = (
  response: Record<string, any>
) => Record<string, any> | undefined;

/**
 * Function to calculate token expiration time
 */
export type ExpiresAtCalculator = (
  response: Record<string, any>
) => string | undefined;

/**
 * OAuth Connector Builder Configuration
 */
export interface OAuthConnectorBuilderConfig<Avail extends string = string> {
  name: string;
  authRequestUrlBase: string;
  accessTokenUrl: string;
  refreshTokenUrl?: string;
  additionalAuthParams?: Record<string, string>;
  additionalTokenParams?: Record<string, string>;
  customHeaders?: Record<string, string>;
  scopes?: Avail[];
  availableScopes?: Avail[];
  scopeConnector?: string;
  extraDataExtractor?: ExtraDataExtractor;
  expiresAtCalculator?: ExpiresAtCalculator;
}

/**
 * OAuth Connector Builder - fluent API for creating OAuth connectors
 */
export class OAuthConnectorBuilder<Avail extends string = string> {
  private config: Partial<OAuthConnectorBuilderConfig<Avail>> = {};

  constructor(name?: string) {
    if (name) {
      this.config.name = name;
    }
    this.config.scopes = [] as Avail[];
    this.config.scopeConnector = " "; // Default to space separator
  }

  /**
   * Copy-constructor: create a builder from an existing OAuthConnectorBuilder
   */
  static from<A extends string = string>(
    source: OAuthConnectorBuilder<A>
  ): OAuthConnectorBuilder<A> {
    const builder = new OAuthConnectorBuilder<A>((source as any).config.name);
    (builder as any).config = JSON.parse(
      JSON.stringify((source as any).config)
    );
    return builder;
  }

  /**
   * Set the OAuth authorization endpoint URL
   */
  withAuthUrl(url: string): this {
    this.config.authRequestUrlBase = url;
    return this;
  }

  /**
   * Set the OAuth token endpoint URL
   */
  withTokenUrl(url: string): this {
    this.config.accessTokenUrl = url;
    return this;
  }

  /**
   * Set the OAuth refresh token endpoint URL (optional, defaults to token URL)
   */
  withRefreshUrl(url: string): this {
    this.config.refreshTokenUrl = url;
    return this;
  }

  /**
   * Add additional parameters to the authorization request
   */
  withAuthParams(params: Record<string, string>): this {
    this.config.additionalAuthParams = {
      ...this.config.additionalAuthParams,
      ...params,
    };
    return this;
  }

  /**
   * Add additional parameters to the token request
   */
  withTokenParams(params: Record<string, string>): this {
    this.config.additionalTokenParams = {
      ...this.config.additionalTokenParams,
      ...params,
    };
    return this;
  }

  /**
   * Add custom headers to requests
   */
  withHeaders(headers: Record<string, string>): this {
    this.config.customHeaders = {
      ...this.config.customHeaders,
      ...headers,
    };
    return this;
  }

  /**
   * Set scopes for the authorization request
   */
  withScope(scopes: ReadonlyArray<Avail>): this {
    this.config.scopes = [...scopes] as Avail[];
    return this;
  }

  /**
   * Define the full set of available scopes that this connector supports
   */
  withAvailableScope<T extends readonly string[]>(
    scopes: T
  ): OAuthConnectorBuilder<T[number]> {
    const unique = Array.from(new Set(scopes as readonly string[]));
    (
      this as unknown as OAuthConnectorBuilder<T[number]>
    ).config.availableScopes = unique as unknown as T[number][];
    return this as unknown as OAuthConnectorBuilder<T[number]>;
  }

  /**
   * Add one or more scopes to the authorization request
   */
  addScope(scope: Avail | ReadonlyArray<Avail>): this {
    if (!this.config.scopes) {
      this.config.scopes = [] as Avail[];
    }

    const scopesToAdd = (Array.isArray(scope) ? scope : [scope]) as Avail[];

    for (const s of scopesToAdd) {
      if (!this.config.scopes.includes(s)) {
        this.config.scopes.push(s);
      }
    }

    return this;
  }

  /**
   * Set the scope connector (separator) - default is space " "
   * Common alternatives: "," for comma, "+" for plus
   */
  withScopeSeparator(connector: string): this {
    this.config.scopeConnector = connector;
    return this;
  }

  /**
   * Set a function to extract custom data from the OAuth token response
   * The extracted data will be stored in the auth's extraData field
   * @param extractor Function that receives the OAuth response and returns data to store
   */
  withExtraData(extractor: ExtraDataExtractor): this {
    this.config.extraDataExtractor = extractor;
    return this;
  }

  /**
   * Set a function to calculate the token expiration time
   * @param calculator Function that receives the OAuth response and returns an ISO date string
   */
  withExpiresAt(calculator: ExpiresAtCalculator): this {
    this.config.expiresAtCalculator = calculator;
    return this;
  }

  /**
   * Build and return a factory function to create instances of the OAuth connector
   */
  build(): (props: OAuthConnectorProps) => OAuthConnector {
    const config = this.config;

    if (!config.authRequestUrlBase) {
      throw new Error(
        `OAuth connector '${config.name}' missing authorization URL`
      );
    }

    if (!config.accessTokenUrl) {
      throw new Error(`OAuth connector '${config.name}' missing token URL`);
    }

    return (props: OAuthConnectorProps) => {
      // Create a dynamic OAuth connector class inside the factory
      class BuiltOAuthConnector extends OAuthConnector {
        constructor(factoryProps: OAuthConnectorProps) {
          super(factoryProps);
        }

        getAuthRequestUrlBase(): string {
          return config.authRequestUrlBase!;
        }

        getAccessTokenUrl(): string {
          return config.accessTokenUrl!;
        }

        getRefreshTokenUrl(): string {
          return config.refreshTokenUrl || config.accessTokenUrl!;
        }

        getAvailableScopes(): string[] {
          return (config.availableScopes as string[] | undefined) ?? [];
        }

        getAuthRequestUrlParams(): Record<string, string> {
          const baseParams = super.getAuthRequestUrlParams();
          const params = {
            ...baseParams,
            ...config.additionalAuthParams,
          };

          // Add scopes if configured
          if (config.scopes && config.scopes.length > 0) {
            params.scope = config.scopes.join(config.scopeConnector || " ");
          }

          return params;
        }

        getRequestAccessTokenParams(code: string): Record<string, string> {
          const baseParams = super.getRequestAccessTokenParams(code);
          return {
            ...baseParams,
            ...config.additionalTokenParams,
          };
        }

        getRequestAccessTokenHeaders(): Record<string, string> {
          const baseHeaders = super.getRequestAccessTokenHeaders();
          return {
            ...baseHeaders,
            ...config.customHeaders,
          };
        }

        protected extractExtraData(
          data: Record<string, any>
        ): Record<string, any> | undefined {
          if (config.extraDataExtractor) {
            return config.extraDataExtractor(data);
          }
          return undefined;
        }

        protected calculateExpiresAt(
          data: Record<string, any>
        ): string | undefined {
          if (config.expiresAtCalculator) {
            return config.expiresAtCalculator(data);
          }
          return super.calculateExpiresAt(data);
        }
      }

      return new BuiltOAuthConnector(props);
    };
  }
}

/**
 * Factory function for creating an OAuth connector builder
 */
export interface CreateOAuthConnectorFn {
  <A extends string = string>(): OAuthConnectorBuilder<A>;
  from: <A extends string = string>(
    source: OAuthConnectorBuilder<A>
  ) => OAuthConnectorBuilder<A>;
}

export const createOAuthConnector: CreateOAuthConnectorFn = (() =>
  new OAuthConnectorBuilder()) as unknown as CreateOAuthConnectorFn;

createOAuthConnector.from = <A extends string = string>(
  source: OAuthConnectorBuilder<A>
) => OAuthConnectorBuilder.from(source);

/**
 * @deprecated Use createOAuthConnector instead
 */
export function defineOAuthConnector(
  name: string
): OAuthConnectorBuilder<string> {
  return new OAuthConnectorBuilder<string>(name);
}
