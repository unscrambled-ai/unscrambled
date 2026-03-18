/**
 * Custom App types for the Unscrambled SDK
 */

export type AuthorizationType = 'OAUTH2' | 'APIKEY' | 'BASIC';

export interface OAuth2Variables {
  clientId?: string;
  clientSecret?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  scopes?: string[];
}

export interface ApiKeyVariables {
  apiKey?: string;
  headerName?: string; // e.g., "X-API-Key"
}

export interface BasicAuthVariables {
  username?: string;
  password?: string;
}

export type AuthVariables = OAuth2Variables | ApiKeyVariables | BasicAuthVariables;

export interface OAuth2Secrets {
  clientSecret?: string;
}

export interface ApiKeySecrets {
  apiKey?: string;
}

export interface BasicAuthSecrets {
  password?: string;
}

export type AuthSecrets = OAuth2Secrets | ApiKeySecrets | BasicAuthSecrets;

export interface CustomApp {
  name: string;
  title?: string;
  authorizationType: AuthorizationType;
  variableNames?: string[];
  secretNames?: string[];
}

// Built-in app reference
export interface BuiltInApp {
  name: string;
  title: string;
  authorizationType: AuthorizationType;
}

// Union type for any app reference
export type App = CustomApp | BuiltInApp;